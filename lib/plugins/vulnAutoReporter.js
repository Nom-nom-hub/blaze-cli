"use strict";
require("dotenv").config();
const isVerbose = process.argv.includes('--verbose');
const chalk = require('chalk');
// Feature not yet implemented: auto-file GitHub issue or send email if critical vuln found.
module.exports = {};
function reportVulns(vulns) {
    const github = process.env.GITHUB_TOKEN;
    const email = process.env.EMAIL_API_KEY;
    if (!github && !email) {
        console.warn("[vulnAutoReporter] No GitHub/email API keys set in .env. Skipping auto-report.");
        return;
    }
    if (Array.isArray(vulns) && vulns.some((v) => v.severity === "critical")) {
        console.warn("[vulnAutoReporter] Critical vulnerability found! Please address immediately.");
        // TODO: Integrate with GitHub/email for auto-reporting
        if (isVerbose) {
            if (github)
                console.log(chalk.cyan('[vulnAutoReporter] Would file GitHub issue.'));
            if (email)
                console.log(chalk.cyan('[vulnAutoReporter] Would send email.'));
        }
    }
}
module.exports = {
    afterAudit: reportVulns,
};
