module.exports = {
  onCommand: ({ command, args, context }) => {
    console.log(`[plugin] Command executed: ${command} (cwd: ${context.cwd})`);
  },
  beforeInstall: ({ args, context }) => {
    console.log('[plugin] Before install hook');
  },
  afterInstall: ({ args, context }) => {
    console.log('[plugin] After install hook');
  },
  beforeUninstall: ({ args, context }) => {
    console.log('[plugin] Before uninstall hook');
  },
  afterUninstall: ({ args, context }) => {
    console.log('[plugin] After uninstall hook');
  },
  beforeUpdate: ({ args, context }) => {
    console.log('[plugin] Before update hook');
  },
  afterUpdate: ({ args, context }) => {
    console.log('[plugin] After update hook');
  },
  beforeAudit: ({ context }) => {
    console.log('[plugin] Before audit hook');
  },
  afterAudit: ({ context }) => {
    console.log('[plugin] After audit hook');
  },
  beforeClean: ({ context }) => {
    console.log('[plugin] Before clean hook');
  },
  afterClean: ({ context }) => {
    console.log('[plugin] After clean hook');
  },
}; 