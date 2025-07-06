const fs = require("fs/promises");
const path = require("path");
const chalk = require("chalk");

async function readPackageJson() {
  const pkgPath = path.resolve(process.cwd(), "package.json");
  
  try {
    const data = await fs.readFile(pkgPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // package.json doesn't exist
      console.log(chalk.red.bold("❌ No package.json found in this directory."));
      console.log(chalk.yellow("\nTo get started:"));
      console.log(chalk.cyan("  • Run ") + chalk.white("npm init -y") + chalk.cyan(" to create a new package.json"));
      console.log(chalk.cyan("  • Or run ") + chalk.white("blaze init") + chalk.cyan(" to create one with Blaze"));
      console.log(chalk.cyan("  • Or navigate to a directory that already has a package.json"));
      console.log(chalk.gray("\nCurrent directory: ") + chalk.white(process.cwd()));
      process.exit(1);
    } else {
      // Other error (permission, corrupted file, etc.)
      console.log(chalk.red.bold("❌ Error reading package.json:"));
      console.log(chalk.red(error.message));
      console.log(chalk.gray("\nFile path: ") + chalk.white(pkgPath));
      process.exit(1);
    }
  }
}

module.exports = { readPackageJson };
