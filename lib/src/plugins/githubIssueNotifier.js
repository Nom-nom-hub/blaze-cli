"use strict";
require("dotenv").config();
function checkGithubIssues() {
    const github = process.env.GITHUB_TOKEN;
    if (!github) {
        console.warn("[githubIssueNotifier] No GitHub token set in .env. Skipping issue check.");
        return;
    }
    // TODO: Use GitHub API to check for open issues
    console.log("[githubIssueNotifier] Would check GitHub issues.");
}
module.exports = {
    afterInstall: checkGithubIssues,
    afterUpdate: checkGithubIssues,
};
