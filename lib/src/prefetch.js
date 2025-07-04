"use strict";
const { resolveDependencies } = require("./resolveDependencies");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const axios = require("axios");
const CACHE_DIR = path.join(os.homedir(), ".blaze_cache");
async function prefetchAll(deps) {
    console.log("Prefetching all dependencies and tarballs for offline use...");
    const tree = await resolveDependencies(deps);
    let count = 0;
    for (const [name, info] of Object.entries(tree)) {
        if (info.version &&
            (info.version.startsWith("file:") || info.version.startsWith("link:")))
            continue;
        // Fetch and cache metadata
        const metaUrl = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
        const metaPath = path.join(CACHE_DIR, `metadata-${name.replace("/", "_")}.json`);
        try {
            const { data } = await axios.get(metaUrl);
            await fs.writeFile(metaPath, JSON.stringify(data), "utf-8");
        }
        catch { } // intentionally empty
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
    }
    console.log(`Prefetch complete. ${Object.keys(tree).length} packages metadata and ${count} tarballs cached.`);
}
module.exports = { prefetchAll };
