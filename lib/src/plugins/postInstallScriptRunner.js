"use strict";
const { execSync } = require("child_process");
const fs = require("fs");
function runPostInstallScript() {
    if (!fs.existsSync(".blazepluginrc"))
        return;
    let config;
    try {
        config = JSON.parse(fs.readFileSync(".blazepluginrc", "utf8"));
    }
    catch (e) {
        console.warn("[postInstallScriptRunner] Could not parse .blazepluginrc:", e.message);
        return;
    }
    if (config.postInstallScript) {
        try {
            console.log(`[postInstallScriptRunner] Running post-install script: ${config.postInstallScript}`);
            execSync(config.postInstallScript, { stdio: "inherit" });
        }
        catch (e) {
            console.warn("[postInstallScriptRunner] Script failed:", e.message);
        }
    }
}
module.exports = {
    afterInstall: runPostInstallScript,
};
