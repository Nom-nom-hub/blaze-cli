"use strict";
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
function autoInstallPeers() {
    const pkg = require("../package.json");
    const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
    const nm = path.join(process.cwd(), "node_modules");
    if (!fs.existsSync(nm))
        return;
    for (const dep of Object.keys(deps)) {
        const pkgJsonPath = path.join(nm, dep, "package.json");
        if (!fs.existsSync(pkgJsonPath))
            continue;
        const peerDeps = require(pkgJsonPath).peerDependencies || {};
        for (const peer in peerDeps) {
            if (!fs.existsSync(path.join(nm, peer))) {
                try {
                    execSync(`npm install ${peer}@${peerDeps[peer]}`, {
                        stdio: "inherit",
                    });
                    console.log(`[peerAutoInstaller] Installed missing peer: ${peer}@${peerDeps[peer]}`);
                }
                catch (e) {
                    // ignore
                }
            }
        }
    }
}
module.exports = {
    afterInstall: autoInstallPeers,
    afterUpdate: autoInstallPeers,
};
