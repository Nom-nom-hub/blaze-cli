"use strict";
const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const chalk = require("chalk");
/**
 * Initialize a new package.json in the current directory
 */
async function initPackageJson() {
    const pkgPath = path.join(process.cwd(), "package.json");
    if (fsSync.existsSync(pkgPath)) {
        console.log(chalk.yellow("⚠️ package.json already exists in this directory."));
        return;
    }
    const defaultPkg = {
        name: path.basename(process.cwd()).toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        version: "1.0.0",
        description: "",
        main: "index.js",
        scripts: {
            test: "echo \"Error: no test specified\" && exit 1"
        },
        keywords: [],
        author: "",
        license: "ISC"
    };
    await fs.writeFile(pkgPath, JSON.stringify(defaultPkg, null, 2) + "\n", "utf-8");
    console.log(chalk.green("✅ Created package.json"));
    console.log(chalk.cyan("📝 Edit package.json to add your project details"));
}
/**
 * Parse npm alias syntax: alias@npm:real-pkg@range
 * @param {string} versionRange - The version range to parse
 * @returns {Object|null} - Parsed alias info or null if not an alias
 */
function parseNpmAlias(versionRange) {
    if (typeof versionRange === "string" && versionRange.startsWith("npm:")) {
        const match = versionRange.match(/^npm:([^@]+)@(.+)$/);
        if (match) {
            return {
                realPkg: match[1],
                realRange: match[2]
            };
        }
    }
    return null;
}
/**
 * Resolve npm alias with cycle detection and depth limiting
 * @param {string} name - Package name
 * @param {string} versionRange - Version range
 * @param {Function} worker - Worker function for recursive resolution
 * @param {Object} resolved - Resolved packages object
 * @param {number} maxDepth - Maximum alias depth (default: 10)
 */
async function resolveNpmAlias(name, versionRange, worker, resolved, maxDepth = 10) {
    const aliasInfo = parseNpmAlias(versionRange);
    if (!aliasInfo) {
        return false; // Not an alias
    }
    const { realPkg, realRange } = aliasInfo;
    // Alias cycle detection and depth limiting
    if (!worker._aliasChain)
        worker._aliasChain = [];
    if (worker._aliasChain.includes(name)) {
        throw new Error(`Alias cycle detected: ${[...worker._aliasChain, name].join(" -> ")}`);
    }
    if (worker._aliasChain.length >= maxDepth) {
        throw new Error(`Alias chain too deep (>${maxDepth}): ${[...worker._aliasChain, name].join(" -> ")}`);
    }
    // Push current alias to the chain
    worker._aliasChain.push(name);
    try {
        // Recursively resolve the real package
        await worker([realPkg, realRange]);
    }
    finally {
        // Pop after recursion
        worker._aliasChain.pop();
    }
    // Copy the resolved real package under the alias name
    resolved[name] = {
        ...resolved[realPkg],
        _alias: true,
        _realPackage: realPkg
    };
    return true; // Alias was resolved
}
module.exports = {
    initPackageJson,
    parseNpmAlias,
    resolveNpmAlias
};
