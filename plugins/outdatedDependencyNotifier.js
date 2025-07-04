const axios = require("axios");
const fs = require("fs");
const path = require("path");

async function checkOutdated() {
  const pkg = require("../package.json");
  const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
  for (const dep of Object.keys(deps)) {
    try {
      const { data } = await axios.get(`https://registry.npmjs.org/${dep}`);
      const latest = data["dist-tags"].latest;
      if (deps[dep] !== latest) {
        console.warn(
          `[outdatedDependencyNotifier] ${dep} is outdated. Latest: ${latest}, Yours: ${deps[dep]}`,
        );
      }
    } catch (e) {
      // ignore
    }
  }
}

async function updateOutdatedDeps() {
  const pkgPath = path.join(process.cwd(), "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
  let updated = false;
  for (const dep of Object.keys(deps)) {
    try {
      const { data } = await axios.get(`https://registry.npmjs.org/${dep}`);
      const latest = data["dist-tags"].latest;
      if (deps[dep] !== latest) {
        if (pkg.dependencies && pkg.dependencies[dep]) {
          pkg.dependencies[dep] = latest;
        }
        if (pkg.devDependencies && pkg.devDependencies[dep]) {
          pkg.devDependencies[dep] = latest;
        }
        console.log(`[outdatedDependencyNotifier] Updated ${dep} to ${latest}`);
        updated = true;
      }
    } catch (e) {
      // ignore
    }
  }
  if (updated) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf8");
    console.log("[outdatedDependencyNotifier] package.json updated with latest versions.");
  } else {
    console.log("[outdatedDependencyNotifier] No outdated dependencies to update.");
  }
}

module.exports = {
  afterInstall: checkOutdated,
  afterUpdate: checkOutdated,
  updateOutdatedDeps,
};
