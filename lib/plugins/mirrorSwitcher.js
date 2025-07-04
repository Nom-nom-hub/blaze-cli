"use strict";
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
function getNpmrcMirrors() {
    const mirrors = [];
    const npmrcPaths = [
        path.join(process.cwd(), '.npmrc'),
        path.join(os.homedir(), '.npmrc'),
    ];
    for (const file of npmrcPaths) {
        if (fs.existsSync(file)) {
            const content = fs.readFileSync(file, 'utf-8');
            const lines = content.split(/\r?\n/);
            for (const line of lines) {
                if (line.startsWith('registry=')) {
                    mirrors.push(line.split('=')[1].trim());
                }
            }
        }
    }
    // Add default npm and yarn mirrors
    mirrors.push('https://registry.npmjs.org/');
    mirrors.push('https://registry.yarnpkg.com/');
    return Array.from(new Set(mirrors));
}
async function testMirrorSpeed(mirror) {
    try {
        const start = Date.now();
        await axios.get(mirror + 'axios'); // test fetch a small package
        return Date.now() - start;
    }
    catch {
        return Infinity;
    }
}
module.exports = {
    onCommand: async ({ command }) => {
        if (command === 'install' || command === 'update') {
            const mirrors = getNpmrcMirrors();
            console.log('[mirrorSwitcher] Detected registry mirrors:');
            for (const m of mirrors)
                console.log('  -', m);
            // Test speed
            const results = await Promise.all(mirrors.map(testMirrorSpeed));
            const fastest = mirrors[results.indexOf(Math.min(...results))];
            console.log('[mirrorSwitcher] Fastest mirror:', fastest, `(${Math.min(...results)}ms)`);
            // Optionally, could switch .npmrc to use fastest here
        }
    },
};
