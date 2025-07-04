const axios = require("axios");

async function reportDepAges() {
  const pkg = require("../package.json");
  const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
  const threshold = 1000 * 60 * 60 * 24 * 30 * 6; // 6 months
  for (const dep of Object.keys(deps)) {
    try {
      const { data } = await axios.get(`https://registry.npmjs.org/${dep}`);
      const last = new Date(data.time[data["dist-tags"].latest]);
      if (Date.now() - last.getTime() > threshold) {
        console.warn(
          `[depAgeReporter] ${dep} has not been updated in over 6 months (last: ${last.toISOString().slice(0, 10)})`,
        );
      }
    } catch (e) {
      // ignore
    }
  }
}

module.exports = {
  afterInstall: reportDepAges,
  afterUpdate: reportDepAges,
};
