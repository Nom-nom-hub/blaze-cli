module.exports = {
  onCommand({ command, args, context }) {
    console.log(`[plugin] Command executed: ${command} (cwd: ${context.cwd})`);
  },
  beforeInstall({ args, context }) {
    console.log('[plugin] Before install hook');
  },
  afterInstall({ args, context }) {
    console.log('[plugin] After install hook');
  }
}; 