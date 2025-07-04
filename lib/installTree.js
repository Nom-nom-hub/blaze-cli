"use strict";
const axios = require("axios");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { ensureInStore } = require("./downloadAndExtract");
const cliProgress = require("cli-progress");
const { spawn } = require("child_process");
const chalk = require('chalk');
let boxen = require('boxen');
if (boxen && boxen.default)
    boxen = boxen.default;
async function runLifecycleScript(pkgDir, scriptName, pkgName) {
    const pkgJsonPath = path.join(pkgDir, "package.json");
    try {
        const data = await fs.readFile(pkgJsonPath, "utf-8");
        const pkg = JSON.parse(data);
        if (pkg.scripts && pkg.scripts[scriptName]) {
            console.log(chalk.cyan(`[${pkgName}] Running ${scriptName} script...`));
            await new Promise((resolve) => {
                const child = spawn(process.platform === "win32" ? "cmd" : "sh", [process.platform === "win32" ? "/c" : "-c", pkg.scripts[scriptName]], {
                    cwd: pkgDir,
                    stdio: "inherit",
                    shell: true,
                });
                child.on("close", async (code) => {
                    if (code !== 0) {
                        console.warn(chalk.yellow(`[${pkgName}] ${scriptName} script failed with code ${code}`));
                    }
                    resolve();
                });
            });
        }
    }
    catch (err) {
        // Ignore errors reading package.json or missing scripts
    }
}
const METADATA_CACHE_DIR = path.join(os.homedir(), ".blaze_metadata_cache");
const TARBALL_CACHE_DIR = path.join(os.homedir(), ".blaze_cache", "tarballs");
async function getTarballUrl(name, version) {
    await fs.mkdir(METADATA_CACHE_DIR, { recursive: true });
    const cacheFile = path.join(METADATA_CACHE_DIR, `${name.replace("/", "_")}-${version}.json`);
    let metadata;
    try {
        const cachedData = await fs.readFile(cacheFile, "utf-8");
        metadata = JSON.parse(cachedData);
    }
    catch (err) {
        if (err.code !== "ENOENT") {
            console.warn(chalk.yellow(`Could not read metadata cache for ${name}@${version}: ${err.message}`));
        }
        const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`;
        const { data } = await axios.get(url);
        metadata = data;
        try {
            await fs.writeFile(cacheFile, JSON.stringify(data), "utf-8");
        }
        catch (err) {
            console.warn(chalk.yellow(`Could not write to metadata cache for ${name}@${version}: ${err.message}`));
        }
    }
    if (metadata.dist && metadata.dist.tarball) {
        return {
            tarballUrl: metadata.dist.tarball,
            shasum: metadata.dist.shasum,
            integrity: metadata.dist.integrity,
            signature: metadata.dist.signature || null,
        };
    }
    return { tarballUrl: null, shasum: null, integrity: null, signature: null };
}
async function safeRemove(target) {
    try {
        const stat = await fs.lstat(target);
        if (stat.isDirectory() && !stat.isSymbolicLink()) {
            // console.log(chalk.gray(`➜ Removing directory at ${target}`));
            await fs.rm(target, { recursive: true, force: true });
        }
        else if (stat.isSymbolicLink()) {
            // console.log(chalk.gray(`➜ Removing symlink at ${target}`));
            await fs.unlink(target);
        }
        else {
            // console.log(chalk.gray(`➜ Removing file at ${target}`));
            await fs.unlink(target);
        }
    }
    catch (err) {
        if (err.code === "ENOENT") {
            // No log for non-existent
        }
        else {
            throw err;
        }
    }
}
async function handleLocalDep(depName, depSpec, nodeModulesDir) {
    const dest = path.join(nodeModulesDir, depName);
    let src = depSpec.replace(/^(file:|link:)/, "");
    src = path.resolve(process.cwd(), src);
    try {
        await fs.rm(dest, { recursive: true, force: true });
    }
    catch { }
    if (depSpec.startsWith("file:")) {
        await fs.cp(src, dest, { recursive: true });
        console.log(chalk.cyan(`Copied local dependency ${depName} from ${src}`));
    }
    else if (depSpec.startsWith("link:")) {
        try {
            await fs.symlink(src, dest, "dir");
            console.log(chalk.cyan(`Symlinked local dependency ${depName} from ${src}`));
        }
        catch (err) {
            if (err.code === "EPERM" || err.code === "EEXIST") {
                await fs.cp(src, dest, { recursive: true });
                console.log(chalk.cyan(`Copied local dependency ${depName} from ${src} (symlink not permitted)`));
            }
            else {
                throw err;
            }
        }
    }
}
function parseGithubSpec(spec) {
    // github:user/repo[#ref] or user/repo[#ref]
    let m = spec.match(/^github:([^/]+)\/([^#]+)(#(.+))?$/);
    if (!m)
        m = spec.match(/^([^/]+)\/([^#]+)(#(.+))?$/);
    if (!m)
        return null;
    const user = m[1], repo = m[2], ref = m[4] || 'main';
    return {
        tarballUrl: `https://codeload.github.com/${user}/${repo}/tar.gz/${ref}`,
        name: repo,
        ref,
    };
}
function isTarballUrl(spec) {
    return /^https?:\/\/.+\.(tgz|tar\.gz)$/.test(spec);
}
async function downloadWithRetry(url, dest, headers = {}, maxRetries = 3) {
    const axiosOpts = { responseType: "stream", headers };
    let lastErr;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await axios.get(url, axiosOpts);
            const writer = require("fs").createWriteStream(dest);
            await new Promise((resolve, reject) => {
                response.data.pipe(writer);
                writer.on("finish", resolve);
                writer.on("error", reject);
            });
            return true;
        }
        catch (err) {
            lastErr = err;
            if (attempt < maxRetries) {
                console.warn(chalk.yellow(`Download failed (attempt ${attempt}): ${err.message}. Retrying...`));
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    }
    throw lastErr;
}
function validateGithubOrTarballSpec(spec) {
    if (isTarballUrl(spec))
        return true;
    if (parseGithubSpec(spec))
        return true;
    return false;
}
function sanitizePackageDirName(name) {
    // Replace /, :, #, @, and any non-alphanumeric with -
    return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}
const isVerbose = process.argv.includes('--verbose');
const forceSymlinks = process.argv.includes('--force-symlinks');
async function installTree(tree, destDir, options = {}) {
    const nodeModulesDir = path.join(destDir, "node_modules");
    await fs.mkdir(nodeModulesDir, { recursive: true });
    const pkgs = Object.entries(tree);
    const bar = new cliProgress.SingleBar({
        format: '{bar} {percentage}% | {value}/{total} 📦',
        barCompleteChar: '█',
        barIncompleteChar: '░',
        hideCursor: true,
        linewrap: false,
        clearOnComplete: false,
        barsize: 30,
    }, cliProgress.Presets.shades_classic);
    bar.start(pkgs.length, 0, { pkg: "" });
    const concurrency = 8;
    let i = 0;
    // Step 1: Resolve all tarball URLs in parallel
    const pkgsWithTarballs = await Promise.all(pkgs.map(async ([name, info]) => {
        if (info.version &&
            (info.version.startsWith("file:") || info.version.startsWith("link:"))) {
            return {
                name,
                info,
                tarballMeta: {
                    tarballUrl: null,
                    shasum: null,
                    integrity: null,
                    signature: null,
                },
            };
        }
        // Handle GitHub and tarball URLs
        if (isTarballUrl(info.version)) {
            return { name, info, tarballMeta: { tarballUrl: info.version } };
        }
        const gh = parseGithubSpec(info.version);
        if (gh) {
            return { name, info, tarballMeta: { tarballUrl: gh.tarballUrl } };
        }
        const tarballMeta = await getTarballUrl(name, info.version);
        return { name, info, tarballMeta };
    }));
    let symlinkedCount = 0;
    let copiedCount = 0;
    async function worker({ name, info, tarballMeta }) {
        bar.update(i, { pkg: chalk.yellow(name) });
        // Handle file: and link: dependencies
        if (!tarballMeta.tarballUrl) {
            await handleLocalDep(name, info.version, nodeModulesDir);
            i++;
            bar.update(i, { pkg: chalk.yellow(name) });
            return;
        }
        // Only handle GitHub/tarball install if info.version is a GitHub/tarball spec
        const isGithubOrTarball = isTarballUrl(info.version) || (parseGithubSpec(info.version) !== null);
        if (isGithubOrTarball && (isTarballUrl(tarballMeta.tarballUrl) || tarballMeta.tarballUrl.includes('codeload.github.com'))) {
            // Validate spec
            if (!validateGithubOrTarballSpec(info.version)) {
                console.error(chalk.red(`Invalid GitHub/tarball spec: '${info.version}'.\nExamples: user/repo, user/repo#branch, github:user/repo#sha, https://example.com/pkg.tgz`));
                throw new Error(`Invalid GitHub/tarball spec: ${info.version}`);
            }
            const safeName = sanitizePackageDirName(name);
            const dest = path.join(nodeModulesDir, safeName);
            await safeRemove(dest);
            await fs.mkdir(dest, { recursive: true });
            await fs.mkdir(TARBALL_CACHE_DIR, { recursive: true });
            // Cache tarball by URL hash
            const crypto = require("crypto");
            const urlHash = crypto.createHash("sha1").update(tarballMeta.tarballUrl).digest("hex");
            const tarballPath = path.join(TARBALL_CACHE_DIR, `${name}-${urlHash}.tar.gz`);
            let usedCache = false;
            if (await fs.stat(tarballPath).then(() => true, () => false)) {
                usedCache = true;
            }
            else {
                // Download with retry and auth if needed
                let headers = {};
                if (tarballMeta.tarballUrl.includes('codeload.github.com')) {
                    const token = process.env.GITHUB_TOKEN;
                    if (token)
                        headers['Authorization'] = `token ${token}`;
                }
                try {
                    await downloadWithRetry(tarballMeta.tarballUrl, tarballPath, headers, 3);
                }
                catch (err) {
                    if (tarballMeta.tarballUrl.includes('codeload.github.com') && (!process.env.GITHUB_TOKEN)) {
                        console.error(chalk.red(`Failed to download from GitHub. If this is a private repo, set GITHUB_TOKEN env var with a personal access token.`));
                    }
                    if (err.response && (err.response.status === 403 || err.response.status === 404)) {
                        console.error(chalk.red(`HTTP ${err.response.status} for ${tarballMeta.tarballUrl}. Check repo access or token.`));
                    }
                    throw err;
                }
            }
            // Extract
            const tar = require("tar");
            try {
                await tar.x({ file: tarballPath, C: dest, strip: 1 });
            }
            catch (err) {
                console.error(chalk.red(`Failed to extract tarball: ${tarballPath}\n${err.message}`));
                throw err;
            }
            if (isVerbose) {
                console.log(chalk.cyan(`Installed ${name} from ${tarballMeta.tarballUrl}${usedCache ? " (from cache)" : ""}`));
            }
            i++;
            bar.update(i, { pkg: chalk.yellow(name) });
            return;
        }
        const storePath = await ensureInStore(name, info.version, tarballMeta);
        const linkPath = path.join(nodeModulesDir, name);
        // Check if already installed and up-to-date
        const installedPkgJson = path.join(linkPath, "package.json");
        let skip = false;
        try {
            const data = await fs.readFile(installedPkgJson, "utf-8");
            const pkg = JSON.parse(data);
            if (pkg.version === info.version) {
                skip = true;
            }
        }
        catch { }
        if (skip) {
            // Already installed and up-to-date
            i++;
            bar.update(i, { pkg: chalk.yellow(name) });
            return;
        }
        await safeRemove(linkPath);
        let didSymlink = false;
        if (options.useSymlinks) {
            try {
                await fs.symlink(storePath, linkPath, "dir");
                didSymlink = true;
                symlinkedCount++;
                if (isVerbose) {
                    console.log(chalk.green(`✔ Symlinked ${name}@${info.version}`));
                }
            }
            catch (err) {
                if (forceSymlinks) {
                    bar.stop();
                    console.error(chalk.red.bold(`❌ Symlink failed for ${name}@${info.version} (${err.code || err.message}).`));
                    console.error(chalk.red('Blaze was run with --force-symlinks, so copying is not allowed.'));
                    console.error(chalk.yellow('To enable symlinks on Windows, run your terminal as administrator or enable Developer Mode in Settings > Update & Security > For Developers.'));
                    process.exit(1);
                }
                copiedCount++;
                console.warn(chalk.yellow(`⚠ Symlink failed for ${name}@${info.version} (${err.code || err.message}). Falling back to copy. Performance will be degraded.`));
                await fs.cp(storePath, linkPath, { recursive: true });
            }
        }
        else {
            copiedCount++;
            await fs.cp(storePath, linkPath, { recursive: true });
            if (isVerbose) {
                console.log(chalk.yellow(`⚠ Copied ${name}@${info.version} (symlinks not enabled)`));
            }
        }
        i++;
        bar.update(i, { pkg: chalk.yellow(name) });
    }
    // Run workers in parallel with concurrency limit
    let idx = 0;
    async function runBatch() {
        const batch = [];
        for (let c = 0; c < concurrency && idx < pkgsWithTarballs.length; c++, idx++) {
            batch.push(worker(pkgsWithTarballs[idx]));
        }
        await Promise.all(batch);
        if (idx < pkgsWithTarballs.length) {
            await runBatch();
        }
    }
    try {
        await runBatch();
    }
    catch (err) {
        bar && bar.stop();
        console.log(boxen(chalk.red.bold('❌ Install failed!') + '\n' + chalk.gray(err.message), {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'red',
            backgroundColor: 'black',
            align: 'center',
        }));
        process.exit(1);
    }
    bar.stop();
    console.log(boxen(chalk.bold.green('✔ All packages installed!'), {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'green',
        backgroundColor: 'black',
        align: 'center',
    }));
    // Print symlink/copy summary
    console.log(chalk.bold(`Symlinked: ${symlinkedCount} packages`));
    if (copiedCount > 0) {
        console.log(chalk.yellow.bold(`Copied: ${copiedCount} packages (performance degraded)`));
        console.log(chalk.yellow('To enable fast installs, run your terminal as administrator or enable Windows Developer Mode.'));
    }
}
module.exports = { installTree, runLifecycleScript };
