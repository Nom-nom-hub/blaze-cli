"use strict";
const axios = require("axios");
async function fetchChangelogs() {
    const pkg = require("../package.json");
    const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
    for (const dep of Object.keys(deps)) {
        try {
            const { data } = await axios.get(`https://registry.npmjs.org/${dep}`);
            const repo = data.repository && data.repository.url;
            if (repo && repo.includes("github.com")) {
                const match = repo.match(/github.com[/:]([^/]+)\/([^/.]+)/);
                if (match) {
                    const [_, owner, repoName] = match;
                    const res = await axios.get(`https://api.github.com/repos/${owner}/${repoName}/releases/latest`);
                    if (res.data && res.data.body) {
                        console.log(`[changelogFetcher] Latest release notes for ${dep}:\n${res.data.body}`);
                    }
                }
            }
        }
        catch (e) {
            // ignore
        }
    }
}
module.exports = {
    afterUpdate: fetchChangelogs,
};
