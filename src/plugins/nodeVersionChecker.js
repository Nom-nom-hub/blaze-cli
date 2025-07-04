const semver = require("semver");
const axios = require("axios");

async function checkNodeVersionCompatibility() {
  const pkg = require("../package.json");
  const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
  const current = process.versions.node;
  for (const dep of Object.keys(deps)) {
    try {
      const { data } = await axios.get(`https://registry.npmjs.org/${dep}`);
      const latest = data["dist-tags"].latest;
      const engines = data.versions[latest].engines;
      if (engines && engines.node && !semver.satisfies(current, engines.node)) {
        console.warn(
          `[nodeVersionChecker] ${dep}@${latest} requires Node.js ${engines.node}, but you have ${current}`,
        );
      }
    } catch (e) {
      // ignore
    }
  }
}

module.exports = {
  afterInstall: checkNodeVersionCompatibility,
  afterUpdate: checkNodeVersionCompatibility,
};
