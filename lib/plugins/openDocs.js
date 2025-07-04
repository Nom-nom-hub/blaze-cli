"use strict";
const axios = require("axios");
const open = require("open");
async function openDocs() {
    const pkg = require("../package.json");
    const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
    for (const dep of Object.keys(deps)) {
        try {
            const { data } = await axios.get(`https://registry.npmjs.org/${dep}`);
            const latest = data["dist-tags"].latest;
            const homepage = data.versions[latest].homepage;
            if (homepage) {
                await open(homepage);
                console.log(`[openDocs] Opened docs for ${dep}: ${homepage}`);
            }
        }
        catch (e) {
            // ignore
        }
    }
}
module.exports = {
    afterInstall: openDocs,
    afterUpdate: openDocs,
};
