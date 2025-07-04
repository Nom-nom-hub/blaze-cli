module.exports = {
  onCommand: ({ command, _context } = {}) => {
    const cwd = _context && _context.cwd ? _context.cwd : 'unknown';
    console.log(`[plugin] Command executed: ${command} (cwd: ${cwd})`);
  },
  beforeInstall: () => {
    console.log("[plugin] Before install hook");
  },
  afterInstall: () => {
    console.log("[plugin] After install hook");
  },
  beforeUninstall: () => {
    console.log("[plugin] Before uninstall hook");
  },
  afterUninstall: () => {
    console.log("[plugin] After uninstall hook");
  },
  beforeUpdate: () => {
    console.log("[plugin] Before update hook");
  },
  afterUpdate: () => {
    console.log("[plugin] After update hook");
  },
  beforeAudit: () => {
    console.log("[plugin] Before audit hook");
  },
  afterAudit: () => {
    console.log("[plugin] After audit hook");
  },
  beforeClean: () => {
    console.log("[plugin] Before clean hook");
  },
  afterClean: () => {
    console.log("[plugin] After clean hook");
  },
};
