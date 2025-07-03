const fs = require('fs');
function log(msg) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync('custom-plugin.log', `[${timestamp}] ${msg}\n`);
  console.log(`[customPlugin] ${msg}`);
}

module.exports = {
  onCommand: ({ command, args, context }) => {
    log(`onCommand: ${command} (cwd: ${context.cwd})`);
  },
  beforeInstall: ({ args, context }) => {
    log('beforeInstall');
  },
  afterInstall: ({ args, context }) => {
    log('afterInstall');
  },
  beforeUninstall: ({ args, context }) => {
    log('beforeUninstall');
  },
  afterUninstall: ({ args, context }) => {
    log('afterUninstall');
  },
  beforeUpdate: ({ args, context }) => {
    log('beforeUpdate');
  },
  afterUpdate: ({ args, context }) => {
    log('afterUpdate');
  },
  beforeAudit: ({ context }) => {
    log('beforeAudit');
  },
  afterAudit: ({ context }) => {
    log('afterAudit');
  },
  beforeClean: ({ context }) => {
    log('beforeClean');
  },
  afterClean: ({ context }) => {
    log('afterClean');
  },
}; 