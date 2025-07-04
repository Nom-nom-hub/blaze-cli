"use strict";
const fs = require("fs/promises");
const path = require("path");
async function writeLockfile(tree) {
    const lockPath = path.resolve(process.cwd(), "blaze-lock.json");
    const data = JSON.stringify(tree, null, 2);
    await fs.writeFile(lockPath, data, "utf-8");
}
module.exports = { writeLockfile };
