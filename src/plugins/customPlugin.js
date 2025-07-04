const fs = require("fs");
function log(msg) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync("custom-plugin.log", `[${timestamp}] ${msg}\n`);
  console.log(`[customPlugin] ${msg}`);
}

module.exports = {
  onCommand: ({ command, _context } = {}) => {
    const cwd = _context && _context.cwd ? _context.cwd : 'unknown';
    log(`onCommand: ${command} (cwd: ${cwd})`);
  },
  beforeInstall: () => {
    log("beforeInstall");
  },
  afterInstall: () => {
    log("afterInstall");
  },
  beforeUninstall: () => {
    log("beforeUninstall");
  },
  afterUninstall: () => {
    log("afterUninstall");
  },
  beforeUpdate: () => {
    log("beforeUpdate");
  },
  afterUpdate: () => {
    log("afterUpdate");
  },
  beforeAudit: () => {
    log("beforeAudit");
  },
  afterAudit: () => {
    log("afterAudit");
  },
  beforeClean: () => {
    log("beforeClean");
  },
  afterClean: () => {
    log("afterClean");
  },
};
