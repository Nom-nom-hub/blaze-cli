"use strict";
const fs = require("fs");
const path = require("path");
function getDirSize(dir) {
    let total = 0;
    if (!fs.existsSync(dir))
        return 0;
    for (const file of fs.readdirSync(dir)) {
        const full = path.join(dir, file);
        if (fs.statSync(full).isDirectory()) {
            total += getDirSize(full);
        }
        else {
            total += fs.statSync(full).size;
        }
    }
    return total;
}
function analyzeSizes() {
    const nm = path.join(process.cwd(), "node_modules");
    if (!fs.existsSync(nm))
        return;
    for (const pkg of fs.readdirSync(nm)) {
        if (pkg.startsWith("."))
            continue;
        const size = getDirSize(path.join(nm, pkg));
        if (size > 10 * 1024 * 1024) {
            console.warn(`[sizeAnalyzer] ${pkg} is large: ${(size / 1024 / 1024).toFixed(2)} MB`);
        }
    }
}
module.exports = {
    afterInstall: analyzeSizes,
    afterUpdate: analyzeSizes,
};
