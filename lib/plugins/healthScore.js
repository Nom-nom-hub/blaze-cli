"use strict";
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const semver = require('semver');
async function getOutdatedDeps(pkg) {
    const outdated = [];
    for (const [name, version] of Object.entries(pkg.dependencies || {})) {
        const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
        try {
            const { data } = await axios.get(url);
            const latest = data['dist-tags'].latest;
            if (semver.validRange(version) && semver.lt(semver.minVersion(version), latest)) {
                outdated.push({ name, current: version, latest });
            }
        }
        catch { }
    }
    return outdated;
}
function getUnusedDeps(pkg, nodeModulesPath) {
    const used = new Set();
    // Simple scan: look for require/import in js/ts files
    function scanDir(dir) {
        for (const file of fs.readdirSync(dir)) {
            const full = path.join(dir, file);
            if (fs.statSync(full).isDirectory())
                scanDir(full);
            else if (file.endsWith('.js') || file.endsWith('.ts')) {
                const content = fs.readFileSync(full, 'utf-8');
                const reqs = content.match(/require\(['"]([^'"]+)['"]\)/g) || [];
                const imps = content.match(/import .* from ['"]([^'"]+)['"]/g) || [];
                for (const r of reqs.concat(imps)) {
                    const m = r.match(/['"]([^'"]+)['"]/);
                    if (m)
                        used.add(m[1]);
                }
            }
        }
    }
    scanDir(process.cwd());
    return Object.keys(pkg.dependencies || {}).filter(dep => !used.has(dep));
}
function getLicenseIssues(pkg) {
    const nonAllowed = [];
    for (const [name, version] of Object.entries(pkg.dependencies || {})) {
        // For demo, just flag left-pad as a bad license
        if (name === 'left-pad')
            nonAllowed.push({ name, license: 'WTFPL' });
    }
    return nonAllowed;
}
module.exports = {
    onCommand: async ({ command }) => {
        if (command === 'install' || command === 'update') {
            const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
            let score = 100;
            const outdated = await getOutdatedDeps(pkg);
            if (outdated.length)
                score -= outdated.length * 5;
            const unused = getUnusedDeps(pkg, path.join(process.cwd(), 'node_modules'));
            if (unused.length)
                score -= unused.length * 2;
            const licenseIssues = getLicenseIssues(pkg);
            if (licenseIssues.length)
                score -= licenseIssues.length * 10;
            // Vulnerabilities would require audit API, skipped for now
            console.log(`[healthScore] Project health score: ${score}/100`);
            if (outdated.length) {
                console.log('  Outdated dependencies:');
                outdated.forEach(x => console.log(`    - ${x.name}: ${x.current} -> ${x.latest}`));
            }
            if (unused.length) {
                console.log('  Unused dependencies:');
                unused.forEach(x => console.log(`    - ${x}`));
            }
            if (licenseIssues.length) {
                console.log('  License issues:');
                licenseIssues.forEach(x => console.log(`    - ${x.name}: ${x.license}`));
            }
            if (score === 100) {
                console.log('  Excellent! No issues detected.');
            }
            else {
                console.log('  Suggestions:');
                if (outdated.length)
                    console.log('    - Update outdated dependencies.');
                if (unused.length)
                    console.log('    - Remove unused dependencies.');
                if (licenseIssues.length)
                    console.log('    - Review flagged licenses.');
            }
        }
    },
};
