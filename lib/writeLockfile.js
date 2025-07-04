"use strict";
const fs = require("fs/promises");
const path = require("path");
async function writeLockfile(tree) {
    const lockPath = path.resolve(process.cwd(), "blaze-lock.json");
    // If the version is a GitHub/tarball spec, store it as the version field in the lockfile
    for (const key in tree) {
        if (tree.hasOwnProperty(key) && tree[key].version && (tree[key].version.startsWith("github:") || tree[key].version.startsWith("tarball:"))) {
            tree[key].version = tree[key].version;
        }
    }
    const data = JSON.stringify(tree, null, 2);
    await fs.writeFile(lockPath, data, "utf-8");
}
module.exports = { writeLockfile };
