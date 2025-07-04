"use strict";
const fs = require("fs");
const path = require("path");
const PLUGIN_HOOKS = [
    "beforeInstall",
    "afterInstall",
    "beforeUpdate",
    "afterUpdate",
    "afterUninstall",
];
const pluginsDir = path.join(__dirname, "..", "plugins");
const pluginFiles = fs.readdirSync(pluginsDir).filter((f) => f.endsWith(".js"));
console.log("--- Blaze Plugin Test Script ---");
for (const file of pluginFiles) {
    const pluginPath = path.join(pluginsDir, file);
    const plugin = require(pluginPath);
    console.log(`\n[TEST] Plugin: ${file}`);
    for (const hook of PLUGIN_HOOKS) {
        if (typeof plugin[hook] === "function") {
            console.log(`  Running hook: ${hook}`);
            try {
                // Try with dummy context
                plugin[hook]({ args: {} });
            }
            catch (e) {
                try {
                    // Fallback: try with no arguments
                    plugin[hook]();
                }
                catch (e2) {
                    console.error(`    [ERROR] ${hook} failed:`, e2.message);
                }
            }
        }
    }
}
console.log("\n--- All plugin hooks tested ---");
