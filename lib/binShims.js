"use strict";
const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
/**
 * Create `node_modules/.bin` shims for installed packages.
 *
 * npm creates a `.bin` entry for every package that declares a `bin` field,
 * so that `npm run <script>` and `npx <tool>` can find the executable. Blaze
 * installs the package contents but never created these shims, which made
 * any package with a `bin` field unusable from a blaze-installed tree:
 *
 *   $ blaze install && npm run build
 *   > tsc
 *   'tsc' is not recognized as an internal or external command
 *
 * This module reproduces npm's behaviour:
 *   - POSIX   : a relative symlink in `.bin` pointing at the target script
 *   - Windows : `name.cmd`, `name.ps1` and `name` (sh) shim files
 *
 * The interpreter is taken from the target's shebang, so packages whose
 * binary is a shell/python script still work. Scripts with no shebang are
 * treated as node scripts, matching npm.
 */
const IS_WINDOWS = process.platform === "win32";
// npm's cmd-shim template. The `endLocal & goto #_undefined_# ... ||` trick
// collapses the whole invocation onto one line so the child's exit code
// propagates back to the caller.
const CMD_TEMPLATE = `@ECHO off
GOTO start
:find_dp0
SET dp0=%~dp0
EXIT /b
:start
SETLOCAL
CALL :find_dp0

IF EXIST "%dp0%\\node.exe" (
  SET "_prog=%dp0%\\node.exe"
) ELSE (
  SET "_prog=node"
  SET PATHEXT=%PATHEXT:;.JS;=;%
)

endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\__TARGET__" %*
`;
const PS1_TEMPLATE = `#!/usr/bin/env pwsh
$basedir=Split-Path $MyInvocation.MyCommand.Definition -Parent

$exe=""
if ($PSVersionTable.PSVersion -lt "6.0" -or $IsWindows) {
  $exe=".exe"
}
$ret=0
if (Test-Path "$basedir/node$exe") {
  $ret = & "$basedir/node$exe"  "$basedir/__TARGET__" $args
} else {
  $ret = & "node$exe"  "$basedir/__TARGET__" $args
}
exit $ret
`;
const SH_TEMPLATE = `#!/bin/sh
basedir=$(dirname "$(echo "$0" | sed -e 's,\\\\,/,g')")

exec node  "$basedir/__TARGET__" "$@"
`;
/**
 * Read the first line of a file and return its shebang (without `#!`), or
 * null when the file has no shebang.
 */
function readShebang(filePath) {
    let fd;
    try {
        fd = fsSync.openSync(filePath, "r");
        const buf = Buffer.alloc(256);
        const bytes = fsSync.readSync(fd, buf, 0, 256, 0);
        const firstLine = buf.slice(0, bytes).toString("utf8").split("\n")[0];
        if (!firstLine.startsWith("#!"))
            return null;
        return firstLine.slice(2).trim();
    }
    catch {
        return null;
    }
    finally {
        if (fd !== undefined) {
            try {
                fsSync.closeSync(fd);
            }
            catch { }
        }
    }
}
/**
 * Work out which interpreter should run a target script.
 *
 * @param {string} filePath - absolute path to the target script
 * @returns {{command: string, args: string[], isNode: boolean}}
 */
function resolveInterpreter(filePath) {
    const shebang = readShebang(filePath);
    if (!shebang) {
        // No shebang: npm assumes node.
        return { command: "node", args: [], isNode: true };
    }
    const parts = shebang.split(/\s+/).filter(Boolean);
    let command = parts[0];
    let args = parts.slice(1);
    if (/(^|\/)env$/.test(command)) {
        // `#!/usr/bin/env node` (optionally with env flags such as -S)
        const idx = args.findIndex((a) => !a.startsWith("-"));
        if (idx === -1)
            return { command: "node", args: [], isNode: true };
        command = args[idx];
        args = args.slice(idx + 1);
    }
    // Strip a leading interpreter path so `#!/usr/bin/node` and `node` are
    // treated the same way.
    const base = command.replace(/^.*[\\/]/, "");
    if (base === "node" || base === "nodejs") {
        return { command: "node", args, isNode: true };
    }
    return { command, args, isNode: false };
}
/**
 * Normalise a package's `bin` field into a list of [name, relativePath].
 *
 * The field is either a string (the name comes from the package name) or an
 * object mapping executable name to path.
 */
function binEntries(pkg) {
    const bin = pkg && pkg.bin;
    if (!bin)
        return [];
    if (typeof bin === "string") {
        const pkgName = pkg.name || "";
        const short = pkgName.startsWith("@")
            ? pkgName.split("/")[1]
            : pkgName;
        return short ? [[short, bin]] : [];
    }
    if (typeof bin === "object") {
        return Object.entries(bin).filter(([name, rel]) => name && typeof rel === "string");
    }
    return [];
}
/**
 * Write the Windows shim files (`.cmd`, `.ps1` and a plain `sh` script) for
 * one executable.
 */
async function writeWindowsShims(binDir, name, targetAbsPath) {
    const rel = path.relative(binDir, targetAbsPath);
    const relWin = rel.split(path.sep).join("\\");
    const relPosix = rel.split(path.sep).join("/");
    await fs.writeFile(path.join(binDir, `${name}.cmd`), CMD_TEMPLATE.replace(/__TARGET__/g, relWin), "utf8");
    await fs.writeFile(path.join(binDir, `${name}.ps1`), PS1_TEMPLATE.replace(/__TARGET__/g, relPosix), "utf8");
    await fs.writeFile(path.join(binDir, name), SH_TEMPLATE.replace(/__TARGET__/g, relPosix), "utf8");
}
/**
 * Create a single `.bin` entry.
 */
async function createShim(binDir, name, pkgDir, binRelPath) {
    const targetAbsPath = path.resolve(pkgDir, binRelPath);
    try {
        await fs.access(targetAbsPath);
    }
    catch {
        // The package declares a bin that does not exist in the tarball.
        // npm warns and skips; we skip silently to keep output readable.
        return false;
    }
    if (IS_WINDOWS) {
        await writeWindowsShims(binDir, name, targetAbsPath);
    }
    else {
        const linkPath = path.join(binDir, name);
        const rel = path.relative(binDir, targetAbsPath);
        try {
            await fs.unlink(linkPath);
        }
        catch { }
        await fs.symlink(rel, linkPath);
        try {
            await fs.chmod(targetAbsPath, 0o755);
        }
        catch { }
    }
    return true;
}
/**
 * List the direct package directories inside a `node_modules` folder,
 * expanding scoped packages (`@scope/name`).
 */
async function listPackages(nodeModulesDir) {
    let entries;
    try {
        entries = await fs.readdir(nodeModulesDir, { withFileTypes: true });
    }
    catch {
        return [];
    }
    const packages = [];
    for (const entry of entries) {
        if (!entry.isDirectory() && !entry.isSymbolicLink())
            continue;
        if (entry.name === ".bin" || entry.name === ".package-lock.json")
            continue;
        if (entry.name.startsWith("."))
            continue;
        if (entry.name.startsWith("@")) {
            let scoped;
            try {
                scoped = await fs.readdir(path.join(nodeModulesDir, entry.name), {
                    withFileTypes: true,
                });
            }
            catch {
                continue;
            }
            for (const child of scoped) {
                if (!child.isDirectory() && !child.isSymbolicLink())
                    continue;
                packages.push({
                    name: `${entry.name}/${child.name}`,
                    dir: path.join(nodeModulesDir, entry.name, child.name),
                });
            }
            continue;
        }
        packages.push({
            name: entry.name,
            dir: path.join(nodeModulesDir, entry.name),
        });
    }
    return packages;
}
/**
 * Create `.bin` shims for every package installed in `nodeModulesDir`, and
 * recurse into nested `node_modules` folders so that transitive packages
 * with binaries are reachable too.
 *
 * @param {string} nodeModulesDir - absolute path to the node_modules folder
 * @param {{verbose?: boolean, depth?: number}} options
 * @returns {Promise<{created: string[], packages: number}>}
 */
async function createBinShims(nodeModulesDir, options = {}) {
    const verbose = !!options.verbose;
    const maxDepth = options.depth === undefined ? 4 : options.depth;
    const created = [];
    let packageCount = 0;
    async function walk(dir, depth) {
        const binDir = path.join(dir, ".bin");
        const packages = await listPackages(dir);
        if (packages.length === 0)
            return;
        await fs.mkdir(binDir, { recursive: true });
        for (const pkg of packages) {
            packageCount++;
            let manifest;
            try {
                manifest = JSON.parse(await fs.readFile(path.join(pkg.dir, "package.json"), "utf8"));
            }
            catch {
                manifest = null;
            }
            if (manifest) {
                for (const [name, relPath] of binEntries(manifest)) {
                    const ok = await createShim(binDir, name, pkg.dir, relPath);
                    if (ok) {
                        created.push(`${pkg.name}:${name}`);
                        if (verbose) {
                            console.log(`  .bin/${name} -> ${pkg.name}`);
                        }
                    }
                }
            }
            if (depth < maxDepth) {
                await walk(path.join(pkg.dir, "node_modules"), depth + 1);
            }
        }
    }
    await walk(nodeModulesDir, 0);
    return { created, packages: packageCount };
}
module.exports = {
    createBinShims,
    createShim,
    binEntries,
    resolveInterpreter,
    readShebang,
};
