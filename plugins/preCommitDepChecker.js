const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

function setupPreCommitHook() {
  const hookPath = path.join(".git", "hooks", "pre-commit");
  const script = `#!/bin/sh\nnode plugins/preCommitDepChecker.js --check || { echo '[preCommitDepChecker] Commit blocked: dependencies are outdated or missing.'; exit 1; }\n`;
  if (
    fs.existsSync(".git") &&
    (!fs.existsSync(hookPath) ||
      !fs.readFileSync(hookPath, "utf8").includes("preCommitDepChecker"))
  ) {
    fs.writeFileSync(hookPath, script, { mode: 0o755 });
    console.log("[preCommitDepChecker] Git pre-commit hook installed.");
  }
}

function checkDeps() {
  try {
    const outdated = execSync("node bin/blaze-install.js outdated --json", {
      encoding: "utf8",
    });
    const list = JSON.parse(outdated);
    if (Array.isArray(list) && list.length > 0) {
      console.warn("[preCommitDepChecker] Outdated dependencies detected:");
      list.forEach((dep) => console.warn(`  - ${dep.name}`));
      process.exit(1);
    }
    // Optionally, check for missing deps here
  } catch (e) {
    // If blaze outdated fails, allow commit (or block, if preferred)
    process.exit(0);
  }
}

if (process.argv.includes("--check")) {
  checkDeps();
}

module.exports = {
  afterInstall: setupPreCommitHook,
  afterUpdate: setupPreCommitHook,
};
