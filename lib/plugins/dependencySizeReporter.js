"use strict";
const fs = require("fs");
const path = require("path");
function getDirSize(dir) {
    let total = 0;
    if (!fs.existsSync(dir))
        return 0;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            total += getDirSize(filePath);
        }
        else {
            total += stat.size;
        }
    }
    return total;
}
function reportLargestDeps() {
    const nodeModules = path.join(process.cwd(), "node_modules");
    if (!fs.existsSync(nodeModules))
        return;
    const pkgs = fs.readdirSync(nodeModules).filter((f) => !f.startsWith("."));
    const sizes = pkgs.map((pkg) => {
        const dir = path.join(nodeModules, pkg);
        return { name: pkg, size: getDirSize(dir) };
    });
    sizes.sort((a, b) => b.size - a.size);
    const top = sizes.slice(0, 5);
    console.log("[dependencySizeReporter] Largest dependencies:");
    top.forEach((dep) => {
        console.log(`  - ${dep.name}: ${(dep.size / 1024 / 1024).toFixed(2)} MB`);
    });
}
module.exports = {
    afterInstall: reportLargestDeps,
    afterUpdate: reportLargestDeps,
};
