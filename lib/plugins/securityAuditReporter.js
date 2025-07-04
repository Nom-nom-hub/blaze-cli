"use strict";
const isVerbose = process.argv.includes('--verbose');
const chalk = require('chalk');
module.exports = {
    afterAudit: () => {
        if (isVerbose) {
            console.log(chalk.cyan('[securityAuditReporter] Audit completed. (To send results to webhook, add your integration here.)'));
        }
    },
};
