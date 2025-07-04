const { resolveDependencies } = require("./resolveDependencies");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const axios = require("axios");
const cliProgress = require("cli-progress");
const chalk = require('chalk');

const CACHE_DIR = path.join(os.homedir(), ".blaze_cache");
const isVerbose = process.argv.includes('--verbose');

async function prefetchAll(deps) {
  console.log(chalk.cyan('✨ Prefetching all dependencies and tarballs for offline use... ✨'));
  const tree = await resolveDependencies(deps);
  let count = 0;
  const pkgs = Object.entries(tree);
  const bar = new cliProgress.SingleBar({
    format: 'Prefetching [{bar}] {value}/{total} {package}',
    clearOnComplete: true
  }, cliProgress.Presets.shades_classic);
  bar.start(pkgs.length, 0, { package: '' });
  let i = 0;
  for (const [name, info] of pkgs) {
    if (
      info.version &&
      (info.version.startsWith("file:") || info.version.startsWith("link:"))
    )
      continue;
    // Fetch and cache metadata
    const metaUrl = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
    const metaPath = path.join(
      CACHE_DIR,
      `metadata-${name.replace("/", "_")}.json`,
    );
    try {
      const { data } = await axios.get(metaUrl);
      await fs.writeFile(metaPath, JSON.stringify(data), "utf-8");
    } catch {} // intentionally empty
    // Fetch and cache tarball
    const version = info.version;
    const meta = JSON.parse(await fs.readFile(metaPath, "utf-8"));
    const tarballUrl = meta.versions[version].dist.tarball;
    const tarballHash = require("crypto")
      .createHash("sha256")
      .update(tarballUrl)
      .digest("hex");
    const tarballPath = path.join(CACHE_DIR, tarballHash + ".tgz");
    if (!(await fs.stat(tarballPath).catch(() => false))) {
      const res = await axios.get(tarballUrl, { responseType: "arraybuffer" });
      await fs.writeFile(tarballPath, res.data);
      count++;
    }
    i++;
    bar.update(i, { package: name });
    // Only show per-package, cache, and internal logs if isVerbose
    if (isVerbose) {
      // e.g. console.log(`[blaze] Prefetched ${name}`);
    }
  }
  bar.stop();
  console.log(
    `Prefetch complete. ${Object.keys(tree).length} packages metadata and ${count} tarballs cached.`,
  );
}

module.exports = { prefetchAll };
