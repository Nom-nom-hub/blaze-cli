"use strict";
const fs = require("fs");
const path = require("path");
const allowedLicenses = ["MIT", "ISC", "Apache-2.0"];
function checkLicenses() {
    const nodeModules = path.join(process.cwd(), "node_modules");
    if (!fs.existsSync(nodeModules))
        return;
    const pkgs = fs.readdirSync(nodeModules).filter((f) => !f.startsWith("."));
    let found = [];
    for (const pkg of pkgs) {
        const pkgJson = path.join(nodeModules, pkg, "package.json");
        if (fs.existsSync(pkgJson)) {
            const data = JSON.parse(fs.readFileSync(pkgJson, "utf8"));
            if (data.license && !allowedLicenses.includes(data.license)) {
                found.push({ name: data.name, license: data.license });
            }
        }
    }
    if (found.length) {
        console.warn("[licenseChecker] Non-allowed licenses found:");
        found.forEach((f) => console.warn(`  - ${f.name}: ${f.license}`));
    }
    else {
        console.log("[licenseChecker] All licenses allowed.");
    }
}
module.exports = {
    afterInstall: checkLicenses,
    afterUpdate: checkLicenses,
};
