const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const tar = require('tar');

const STORE_DIR = path.join(os.homedir(), '.blaze_store');
const CACHE_DIR = path.join(os.homedir(), '.blaze_cache');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function downloadTarball(tarballUrl, cachePath) {
  const response = await axios.get(tarballUrl, { responseType: 'stream' });
  const writer = (await fs.open(cachePath, 'w')).createWriteStream();
  await new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function ensureInStore(name, version, tarballUrl) {
  const storePath = path.join(STORE_DIR, name.replace('/', '_'), version);
  await ensureDir(storePath);
  // Check if already extracted (package.json exists)
  try {
    await fs.access(path.join(storePath, 'package.json'));
    return storePath;
  } catch {}
  // Download tarball to cache if needed
  await ensureDir(CACHE_DIR);
  const cachePath = path.join(CACHE_DIR, `${name.replace('/', '_')}-${version}.tgz`);
  try {
    await fs.access(cachePath);
  } catch {
    await downloadTarball(tarballUrl, cachePath);
  }
  // Extract to store
  await tar.x({
    file: cachePath,
    cwd: storePath,
    strip: 1,
  });
  return storePath;
}

module.exports = { ensureInStore }; 