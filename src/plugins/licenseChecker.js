const fs = require("fs");
const path = require("path");
const allowedLicenses = ["MIT", "ISC", "Apache-2.0"];
const isVerbose = process.argv.includes('--verbose');
const chalk = require('chalk');

function checkLicenses() {
  const nodeModules = path.join(process.cwd(), "node_modules");
  if (!fs.existsSync(nodeModules)) return;
  const pkgs = fs.readdirSync(nodeModules).filter((f) => !f.startsWith("."));
  let found = [];
  for (const pkg of pkgs) {
    const pkgJson = path.join(nodeModules, pkg, "package.json");
    if (fs.existsSync(pkgJson)) {
      const data = JSON.parse(fs.readFileSync(pkgJson, "utf8"));
      if (data.license && !allowedLicenses.includes(data.license)) {
        found.push({ name: data.name, license: data.license });
      }
    }
  }
  if (isVerbose) {
    if (found.length) {
      console.warn(chalk.yellow.bold('[licenseChecker] Non-allowed licenses found:'));
      found.forEach((f) => console.warn(chalk.yellow(`  - ${f.name}: ${f.license}`)));
    } else {
      console.log(chalk.green('[licenseChecker] All licenses allowed.'));
    }
  }
}

module.exports = {
  afterInstall: checkLicenses,
  afterUpdate: checkLicenses,
};
