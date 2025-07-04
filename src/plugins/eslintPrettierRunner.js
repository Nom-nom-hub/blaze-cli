const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const isVerbose = process.argv.includes('--verbose');
const chalk = require('chalk');

function getLintTargets() {
  const candidates = ["lib", "plugins", "test", "src"];
  return candidates.filter((dir) => fs.existsSync(path.join(process.cwd(), dir)));
}

function runLinters() {
  const targets = getLintTargets();
  if (targets.length === 0) {
    if (isVerbose) {
      console.warn(chalk.yellow("[eslintPrettierRunner] No source directories found to lint."));
    }
    return;
  }
  try {
    execSync(`npx eslint ${targets.join(" ")}`, { stdio: "inherit" });
    if (isVerbose) {
      console.log(chalk.green("[eslintPrettierRunner] ESLint passed."));
    }
  } catch (e) {
    if (isVerbose) {
      console.warn(chalk.red("[eslintPrettierRunner] ESLint failed."));
    }
  }
  try {
    execSync(`npx prettier --check ${targets.join(" ")}`, { stdio: "inherit" });
    if (isVerbose) {
      console.log(chalk.green("[eslintPrettierRunner] Prettier check passed."));
    }
  } catch (e) {
    if (isVerbose) {
      console.warn(chalk.red("[eslintPrettierRunner] Prettier check failed."));
    }
  }
}

function runLintersFix() {
  const targets = getLintTargets();
  if (targets.length === 0) {
    if (isVerbose) {
      console.warn(chalk.yellow("[eslintPrettierRunner] No source directories found to fix."));
    }
    return;
  }
  try {
    execSync(`npx eslint ${targets.join(" ")} --fix`, { stdio: "inherit" });
    if (isVerbose) {
      console.log(chalk.green("[eslintPrettierRunner] ESLint auto-fix complete."));
    }
  } catch (e) {
    if (isVerbose) {
      console.warn(chalk.red("[eslintPrettierRunner] ESLint auto-fix failed."));
    }
  }
  try {
    execSync(`npx prettier --write ${targets.join(" ")}`, { stdio: "inherit" });
    if (isVerbose) {
      console.log(chalk.green("[eslintPrettierRunner] Prettier auto-fix complete."));
    }
  } catch (e) {
    if (isVerbose) {
      console.warn(chalk.red("[eslintPrettierRunner] Prettier auto-fix failed."));
    }
  }
}

module.exports = {
  afterInstall: runLinters,
  afterUpdate: runLinters,
  runLintersFix,
};
