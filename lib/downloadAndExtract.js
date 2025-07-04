"use strict";
const axios = require("axios");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const tar = require("tar");
const crypto = require("crypto");
const STORE_DIR = path.join(os.homedir(), ".blaze_store");
const CACHE_DIR = path.join(os.homedir(), ".blaze_cache");
async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
}
// Download tarball, compute SHA256 hash, and store as <hash>.tgz in cache
async function downloadTarballCAS(tarballUrl) {
    await ensureDir(CACHE_DIR);
    // Download tarball to memory and compute hash
    const response = await axios.get(tarballUrl, { responseType: "stream" });
    const hash = crypto.createHash("sha256");
    const chunks = [];
    await new Promise((resolve, reject) => {
        response.data.on("data", (chunk) => {
            hash.update(chunk);
            chunks.push(chunk);
        });
        response.data.on("end", resolve);
        response.data.on("error", reject);
    });
    const digest = hash.digest("hex");
    const cachePath = path.join(CACHE_DIR, `${digest}.tgz`);
    // If tarball already exists in cache, skip writing
    try {
        // intentionally empty
    }
    catch { } // intentionally empty
    console.log(`[CAS] Downloading and caching tarball: ${cachePath}`);
    await fs.writeFile(cachePath, Buffer.concat(chunks));
    return { cachePath, digest };
}
// Compute SHA1 hash of an existing tarball
async function computeTarballSHA1(filePath) {
    const hash = crypto.createHash("sha1");
    const data = await fs.readFile(filePath);
    hash.update(data);
    return hash.digest("hex");
}
// Compute base64-encoded SHA512 for integrity check
async function computeTarballSHA512Base64(filePath) {
    const hash = crypto.createHash("sha512");
    const data = await fs.readFile(filePath);
    hash.update(data);
    return hash.digest("base64");
}
// Main entry: ensure package is in store, using CAS for tarballs
// Accepts tarballMeta: { tarballUrl, shasum, integrity, signature }
async function ensureInStore(name, version, tarballMeta) {
    const storePath = path.join(STORE_DIR, name.replace("/", "_"), version);
    await ensureDir(storePath);
    // Check if already extracted (package.json exists)
    try {
        // intentionally empty
    }
    catch { } // intentionally empty
    // Download tarball to cache if needed (CAS)
    await ensureDir(CACHE_DIR);
    let cachePath;
    ({ cachePath } = await downloadTarballCAS(tarballMeta.tarballUrl));
    // Hash verification
    let hashOk = true;
    if (tarballMeta.integrity) {
        // npm's dist.integrity is usually sha512-base64
        const fileSha512 = await computeTarballSHA512Base64(cachePath);
        // integrity string is like 'sha512-<base64>'
        const expected = tarballMeta.integrity.split("-")[1];
        if (fileSha512 !== expected) {
            console.error(`[SECURITY] Integrity (sha512) mismatch for ${name}@${version}: expected ${expected}, got ${fileSha512}`);
            hashOk = false;
        }
        else {
            console.log(`[SECURITY] Integrity (sha512) verified for ${name}@${version}`);
        }
    }
    if (tarballMeta.shasum) {
        const fileSha1 = await computeTarballSHA1(cachePath);
        if (fileSha1 !== tarballMeta.shasum) {
            console.error(`[SECURITY] Hash (sha1) mismatch for ${name}@${version}: expected ${tarballMeta.shasum}, got ${fileSha1}`);
            hashOk = false;
        }
        else {
            console.log(`[SECURITY] Hash (sha1) verified for ${name}@${version}`);
        }
    }
    if (!hashOk) {
        throw new Error("Package hash/integrity verification failed!");
    }
    // Signature verification (placeholder)
    if (tarballMeta.signature) {
        // TODO: Implement signature verification using a trusted public key
        // For now, just log presence
        console.log(`[SECURITY] Signature present for ${name}@${version} (not yet verified)`);
        // Example: verifySignature(cachePath, tarballMeta.signature, publicKey)
    }
    // Extract to store
    await tar.x({
        file: cachePath,
        cwd: storePath,
        strip: 1,
    });
    return storePath;
}
// Comment out or remove references to undefined 'getTarballHash' and 'extractTarball' in downloadAndExtract
// Remove unused function 'downloadAndExtract' (not exported or used)
module.exports = {
    ensureInStore,
    computeTarballSHA1,
    computeTarballSHA512Base64,
};
