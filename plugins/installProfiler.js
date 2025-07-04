let start;
function beforeInstall() {
  start = Date.now();
}
function afterInstall() {
  if (start) {
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`[installProfiler] Install took ${duration} seconds.`);
  }
}

module.exports = {
  beforeInstall,
  afterInstall,
};
