const chalk = require('chalk');
const { readPackageJson } = require("./readPackageJson");

/**
 * Parse command line arguments into command and options
 * @param {Array} args - Command line arguments
 * @returns {Object} - Parsed command and options
 */
function parseArgs(args) {
  const [command, ...rest] = args;
  
  // Extract flags
  const flags = {
    offline: rest.includes("--offline"),
    auditFix: rest.includes("--audit-fix"),
    noLockfile: rest.includes("--no-lockfile"),
    production: rest.includes("--production"),
    saveDev: rest.includes("--save-dev") || rest.includes("-D"),
    ci: rest.includes("--ci"),
    verbose: rest.includes("--verbose"),
    noSymlink: rest.includes("--no-symlink")
  };

  // Extract workspace target
  const workspaceFlagIndex = rest.findIndex((arg) => arg === "--workspace");
  let workspaceTarget = null;
  if (workspaceFlagIndex !== -1 && rest[workspaceFlagIndex + 1]) {
    workspaceTarget = rest[workspaceFlagIndex + 1];
  }

  // Filter out CLI flags from rest (package names)
  const packages = rest.filter(
    (arg) => !arg.startsWith("--") && arg !== command,
  );

  return {
    command,
    packages,
    flags,
    workspaceTarget
  };
}

/**
 * Handle package.json not found error with user-friendly messaging
 * @param {Error} error - The error from readPackageJson
 */
function handlePackageJsonError(error) {
  console.log(chalk.red.bold("❌ " + error.message));
  console.log(chalk.yellow("\nTo get started:"));
  console.log(chalk.cyan("  • Run ") + chalk.white("npm init -y") + chalk.cyan(" to create a new package.json"));
  console.log(chalk.cyan("  • Or run ") + chalk.white("blaze init") + chalk.cyan(" to create one with Blaze"));
  console.log(chalk.cyan("  • Or navigate to a directory that already has a package.json"));
  console.log(chalk.gray("\nCurrent directory: ") + chalk.white(process.cwd()));
  process.exit(1);
}

/**
 * Safely read package.json with error handling
 * @returns {Object} - Package.json contents
 */
async function safeReadPackageJson() {
  try {
    return await readPackageJson();
  } catch (error) {
    handlePackageJsonError(error);
  }
}

/**
 * Validate command arguments
 * @param {string} command - Command name
 * @param {Array} packages - Package arguments
 * @param {string} usage - Usage message
 */
function validateCommand(command, packages, usage) {
  if (!packages.length) {
    console.log(`Usage: blaze ${command} ${usage}`);
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  handlePackageJsonError,
  safeReadPackageJson,
  validateCommand
}; 