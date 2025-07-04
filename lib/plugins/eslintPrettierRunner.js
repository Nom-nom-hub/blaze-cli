"use strict";
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
function getLintTargets() {
    const candidates = ["lib", "plugins", "test", "src"];
    return candidates.filter((dir) => fs.existsSync(path.join(process.cwd(), dir)));
}
function runLinters() {
    const targets = getLintTargets();
    if (targets.length === 0) {
        console.warn("[eslintPrettierRunner] No source directories found to lint.");
        return;
    }
    try {
        execSync(`npx eslint ${targets.join(" ")}`, { stdio: "inherit" });
        console.log("[eslintPrettierRunner] ESLint passed.");
    }
    catch (e) {
        console.warn("[eslintPrettierRunner] ESLint failed.");
    }
    try {
        execSync(`npx prettier --check ${targets.join(" ")}`, { stdio: "inherit" });
        console.log("[eslintPrettierRunner] Prettier check passed.");
    }
    catch (e) {
        console.warn("[eslintPrettierRunner] Prettier check failed.");
    }
}
function runLintersFix() {
    const targets = getLintTargets();
    if (targets.length === 0) {
        console.warn("[eslintPrettierRunner] No source directories found to fix.");
        return;
    }
    try {
        execSync(`npx eslint ${targets.join(" ")} --fix`, { stdio: "inherit" });
        console.log("[eslintPrettierRunner] ESLint auto-fix complete.");
    }
    catch (e) {
        console.warn("[eslintPrettierRunner] ESLint auto-fix failed.");
    }
    try {
        execSync(`npx prettier --write ${targets.join(" ")}`, { stdio: "inherit" });
        console.log("[eslintPrettierRunner] Prettier auto-fix complete.");
    }
    catch (e) {
        console.warn("[eslintPrettierRunner] Prettier auto-fix failed.");
    }
}
module.exports = {
    afterInstall: runLinters,
    afterUpdate: runLinters,
    runLintersFix,
};
