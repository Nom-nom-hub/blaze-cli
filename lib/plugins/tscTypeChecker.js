"use strict";
const { execSync } = require("child_process");
const isVerbose = process.argv.includes('--verbose');
const chalk = require('chalk');
function runTypeCheck() {
    try {
        execSync("npx tsc --noEmit", { stdio: "inherit" });
        if (isVerbose) {
            console.log(chalk.green('[tscTypeChecker] TypeScript type check passed.'));
        }
    }
    catch (e) {
        if (isVerbose) {
            console.warn(chalk.red('[tscTypeChecker] TypeScript type check failed.'));
        }
    }
}
module.exports = {
    afterInstall: runTypeCheck,
    afterUpdate: runTypeCheck,
};
