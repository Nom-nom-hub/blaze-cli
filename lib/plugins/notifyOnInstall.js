"use strict";
const isVerbose = process.argv.includes('--verbose');
const chalk = require('chalk');
if (isVerbose) {
    console.log(chalk.cyan.bold('✨ [notifyOnInstall] Install finished! ✨'));
}
module.exports = {
    afterInstall: () => {
        console.log("\x1b[36m[notifyOnInstall]\x1b[0m Install finished!");
    },
};
