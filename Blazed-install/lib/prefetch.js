const { resolveDependencies } = require('./resolveDependencies');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const axios = require('axios');

const CACHE_DIR = path.join(os.homedir(), '.blaze_cache');
const PREFETCH_DIR = path.join(os.homedir(), '.blaze_prefetch');

async function prefetchAll(deps) {console.log('Prefetching all dependencies and tarballs for offline use...');
  const tree = await resolveDependencies(deps);
  let count = 0;
  for (const [name, info] of Object.entries(tree.tree)) {
    if (info.version && (info.version.startsWith('file:') || info.version.startsWith('link:'))) continue;
    // Fetch and cache metadata
    const metaUrl = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
    const metaPath = path.join(CACHE_DIR, `metadata-${name.replace('/', '_')}.json`);
    try {
      const { data } = await axios.get(metaUrl);
      await fs.writeFile(metaPath, JSON.stringify(data), 'utf-8');
    } catch {}
    // Fetch and cache tarball
    const version = info.version;
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
    const tarballUrl = meta.versions[version].dist.tarball;
    const tarballHash = require('crypto').createHash('sha256').update(tarballUrl).digest('hex');
    const tarballPath = path.join(CACHE_DIR, tarballHash + '.tgz');
    if (!(await fs.stat(tarballPath).catch(() => false))) {
      const res = await axios.get(tarballUrl, { responseType: 'arraybuffer' });
      await fs.writeFile(tarballPath, res.data);
      count++;
    }
  }
  console.log(`Prefetch complete. ${Object.keys(tree.tree).length} packages metadata and ${count} tarballs cached.`);
}

async function prefetchPackages(packages, options = {}) {
  try {
    await fs.mkdir(PREFETCH_DIR, { recursive: true });
    const results = [];
    
    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      const prefetchPath = getPrefetchPath(pkg.name, pkg.version);
      
      try {
        // Simulate prefetching
        await fs.writeFile(prefetchPath, JSON.stringify(pkg));
        results.push({ name: pkg.name, version: pkg.version, success: true });
        
        if (options.progress) {
          options.progress({ current: i + 1, total: packages.length, package: pkg.name });
        }
      } catch (err) {
        results.push({ name: pkg.name, version: pkg.version, success: false, error: err.message });
      }
    }
    
    return results;
  } catch (err) {
    return packages.map(pkg => ({ name: pkg.name, version: pkg.version, success: false, error: err.message }));
  }
}

async function isPrefetched(packageName, version) {
  try {
    const prefetchPath = getPrefetchPath(packageName, version);
    await fs.access(prefetchPath, fs.constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
}

async function getPrefetchStats() {
  try {
    const files = await fs.readdir(PREFETCH_DIR);
    let totalSize = 0;
    
    for (const file of files) {
      try {
        const stats = await fs.stat(path.join(PREFETCH_DIR, file));
        totalSize += stats.size;
      } catch (err) {
        // Ignore errors for individual files
      }
    }
    
    return {
      totalPackages: files.length,
      totalSize
    };
  } catch (err) {
    return { totalPackages: 0, totalSize: 0 };
  }
}

async function clearPrefetchCache() {
  try {
    const files = await fs.readdir(PREFETCH_DIR);
    
    for (const file of files) {
      try {
        await fs.rm(path.join(PREFETCH_DIR, file), { force: true });
      } catch (err) {
        // Ignore errors for individual files
      }
    }
    
    return true;
  } catch (err) {
    return false;
  }
}

function getPrefetchPath(packageName, version) {
  const safeName = packageName.replace('/', '_');
  return path.join(PREFETCH_DIR, `${safeName}-${version}.json`);
}

module.exports = { 
  prefetchAll, 
  prefetchPackages, 
  isPrefetched, 
  getPrefetchStats, 
  clearPrefetchCache, 
  getPrefetchPath 
}; 