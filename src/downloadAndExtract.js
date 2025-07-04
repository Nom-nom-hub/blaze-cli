const isVerbose = process.argv.includes('--verbose');
if (isVerbose) {
  console.log('[CAS-DEBUG] downloadAndExtract.js loaded');
}
// This must be the first code executed in this file!
const axios = require("axios");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const tar = require("tar");
const crypto = require("crypto");
const fsSync = require("fs");
const chalk = require('chalk');

const STORE_DIR = path.join(os.homedir(), ".blaze_store");
const CACHE_DIR = path.join(os.homedir(), ".blaze_cache");

// Synchronous cache fix-up at startup: only for tarball hash files, not metadata
try {
  const files = fsSync.readdirSync(CACHE_DIR);
  for (const file of files) {
    // Only operate on files that look like tarball hashes (40+ hex chars, ending in 'z', not .json, not directories)
    if (/^[a-f0-9]{40,}z$/.test(file)) {
      const oldPath = path.join(CACHE_DIR, file);
      const newPath = oldPath.slice(0, -1) + 'tgz';
      try {
        fsSync.renameSync(oldPath, newPath);
      } catch (e) {
        // Silently ignore errors
      }
    }
  }
} catch (e) {
  // Ignore if cache dir doesn't exist yet
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

// Download tarball, compute SHA256 hash, and store as <hash>.tgz in cache
async function downloadTarballCAS(tarballUrl) {
  await ensureDir(CACHE_DIR);
  // Compute hash of the URL (not the content) for cache key
  const hash = crypto.createHash("sha256");
  hash.update(tarballUrl);
  const digest = hash.digest("hex");
  const cachePath = path.join(CACHE_DIR, `${digest}.tgz`);
  if (isVerbose) {
    console.log(chalk.gray(`[CAS] Using cached tarball: ${cachePath}`));
  }
  // If tarball already exists in cache, use it
  try {
    await fs.access(cachePath);
    if (isVerbose) {
      console.log(chalk.gray(`[CAS] Using cached tarball: ${cachePath}`));
    }
    return { cachePath, digest };
  } catch {
    if (isVerbose) {
      console.log(chalk.gray(`[CAS] Cache miss for: ${cachePath}`));
    }
    // Not in cache, proceed to download
  }
  // Download tarball to memory and compute hash
  const response = await axios.get(tarballUrl, { responseType: "stream" });
  const chunks = [];
  await new Promise((resolve, reject) => {
    response.data.on("data", (chunk) => {
      chunks.push(chunk);
    });
    response.data.on("end", resolve);
    response.data.on("error", reject);
  });
  if (isVerbose) {
    console.log(chalk.gray(`[CAS] Downloading and caching tarball: ${cachePath}`));
  }
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
  } catch {} // intentionally empty
  // Download tarball to cache if needed (CAS)
  await ensureDir(CACHE_DIR);
  let cachePath;
  ({ cachePath } = await downloadTarballCAS(tarballMeta.tarballUrl));
  // Hash verification
  let hashOk = true;
  if (tarballMeta.integrity) {
    const fileSha512 = await computeTarballSHA512Base64(cachePath);
    const expected = tarballMeta.integrity.split('-')[1];
    if (fileSha512 !== expected) {
      if (isVerbose) console.error(chalk.red(`[SECURITY] Integrity (sha512) mismatch for ${name}@${version}: expected ${expected}, got ${fileSha512}`));
      hashOk = false;
    } else {
      if (isVerbose) console.log(chalk.green(`[SECURITY] Integrity (sha512) verified for ${name}@${version}`));
    }
  }
  if (tarballMeta.shasum) {
    const fileSha1 = await computeTarballSHA1(cachePath);
    if (fileSha1 !== tarballMeta.shasum) {
      if (isVerbose) console.error(chalk.red(`[SECURITY] Hash (sha1) mismatch for ${name}@${version}: expected ${tarballMeta.shasum}, got ${fileSha1}`));
      hashOk = false;
    } else {
      if (isVerbose) console.log(chalk.green(`[SECURITY] Hash (sha1) verified for ${name}@${version}`));
    }
  }
  if (!hashOk) {
    throw new Error('Package hash/integrity verification failed!');
  }
  // Signature verification (placeholder)
  if (tarballMeta.signature) {
    if (isVerbose) console.log(chalk.yellow(`[SECURITY] Signature present for ${name}@${version} (not yet verified)`));
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
