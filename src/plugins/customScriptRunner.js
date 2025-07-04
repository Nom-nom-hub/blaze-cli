const { execSync } = require("child_process");
const fs = require("fs");

function runScript(hook) {
  if (!fs.existsSync(".blazepluginrc")) return;
  const config = JSON.parse(fs.readFileSync(".blazepluginrc", "utf8"));
  if (config[hook]) {
    try {
      console.log(
        `[customScriptRunner] Running script for ${hook}: ${config[hook]}`,
      );
      execSync(config[hook], { stdio: "inherit" });
    } catch (e) {
      console.warn(
        `[customScriptRunner] Script for ${hook} failed:`,
        e.message,
      );
    }
  }
}

module.exports = {
  beforeInstall: () => runScript("beforeInstall"),
  afterInstall: () => runScript("afterInstall"),
  beforeUninstall: () => runScript("beforeUninstall"),
  afterUninstall: () => runScript("afterUninstall"),
};
