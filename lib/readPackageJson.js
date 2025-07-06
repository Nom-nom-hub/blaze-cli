"use strict";
const fs = require("fs/promises");
const path = require("path");
const chalk = require("chalk");
async function readPackageJson() {
    const pkgPath = path.resolve(process.cwd(), "package.json");
    try {
        const data = await fs.readFile(pkgPath, "utf-8");
        return JSON.parse(data);
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            // package.json doesn't exist
            const errorMessage = `No package.json found in this directory (${process.cwd()}). To get started: run 'npm init -y' or 'blaze init' to create a new package.json, or navigate to a directory that already has a package.json.`;
            throw new Error(errorMessage);
        }
        else {
            // Other error (permission, corrupted file, etc.)
            throw new Error(`Error reading package.json (${pkgPath}): ${error.message}`);
        }
    }
}
module.exports = { readPackageJson };
