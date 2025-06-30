const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { ensureInStore } = require('./downloadAndExtract');
const cliProgress = require('cli-progress');
const { spawn } = require('child_process');

// Simple color functions to avoid chalk ES module issues
const colors = {
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`
};

async function runLifecycleScript(pkgDir, scriptName, pkgName) {const pkgJsonPath = path.join(pkgDir, 'package.json');
  try {
    const data = await fs.readFile(pkgJsonPath, 'utf-8');
    const pkg = JSON.parse(data);
    if (pkg.scripts && pkg.scripts[scriptName]) {console.log(colors.cyan(`[${pkgName}] Running ${scriptName} script...`));
      
      // Enhanced script execution with better error handling
      const result = await new Promise((resolve) => {
        const child = spawn(process.platform === 'win32' ? 'cmd' : 'sh',
          [process.platform === 'win32' ? '/c' : '-c', pkg.scripts[scriptName]], {
          cwd: pkgDir,
          stdio: 'inherit',
          shell: true,
          env: {
            ...process.env,
            NODE_ENV: process.env.NODE_ENV || 'production'
          }
        });
        
        child.on('close', async (code) => {
          if (code !== 0) {console.warn(colors.yellow(`[${pkgName}] ${scriptName} script failed with code ${code}`));
            // Don't fail the entire install for script failures
            // Some packages have optional postinstall scripts
            resolve({ success: false, code });
          } else {
            console.log(colors.green(`[${pkgName}] ${scriptName} script completed successfully`));
            resolve({ success: true, code: 0 });
          }
        });
        
        child.on('error', async (err) => {
          console.warn(colors.yellow(`[${pkgName}] ${scriptName} script error: ${err.message}`));
          resolve({ success: false, error: err.message });
        });
      });
      
      return result;
    }
  } catch (err) {
    // Ignore errors reading package.json or missing scripts
    console.debug(`[DEBUG] Could not run ${scriptName} for ${pkgName}: ${err.message}`);
  }
  return { success: true, code: 0 };
}

const METADATA_CACHE_DIR = path.join(os.homedir(), '.blaze_metadata_cache');

async function getTarballUrl(name, version) {await fs.mkdir(METADATA_CACHE_DIR, { recursive: true });
  const cacheFile = path.join(METADATA_CACHE_DIR, `${name.replace('/', '_')}-${version}.json`);
  let metadata;
  try {
    const cachedData = await fs.readFile(cacheFile, 'utf-8');
    metadata = JSON.parse(cachedData);
  } catch (err) {
    if (err.code !== 'ENOENT') {console.warn(colors.yellow(`Could not read metadata cache for ${name}@${version}: ${err.message}`));
    }
    const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`;
    const { data } = await axios.get(url);
    metadata = data;
    try {
      await fs.writeFile(cacheFile, JSON.stringify(data), 'utf-8');
    } catch (err) {
      console.warn(colors.yellow(`Could not write to metadata cache for ${name}@${version}: ${err.message}`));
    }
  }
  if (metadata.dist && metadata.dist.tarball) {return {
      tarballUrl: metadata.dist.tarball,
      shasum: metadata.dist.shasum,
      integrity: metadata.dist.integrity,
      signature: metadata.dist.signature || null
    };
  }
  return { tarballUrl: null, shasum: null, integrity: null, signature: null };
}

async function safeRemove(target) {try {
    const stat = await fs.lstat(target);
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      // console.log(chalk.gray(`➜ Removing directory at ${target}`));
      await fs.rm(target, { recursive: true, force: true });
    } else if (stat.isSymbolicLink()) {
      // console.log(chalk.gray(`➜ Removing symlink at ${target}`));
      await fs.unlink(target);
    } else {
      // console.log(chalk.gray(`➜ Removing file at ${target}`));
      await fs.unlink(target);
    }
  } catch (err) {
    if (err.code === 'ENOENT') {// No log for non-existent
    } else {
      throw err;
    }
  }
}

async function handleLocalDep(depName, depSpec, nodeModulesDir) {const dest = path.join(nodeModulesDir, depName);
  let src = depSpec.replace(/^(file:|link:)/, '');
  src = path.resolve(process.cwd(), src);
  try {
    await fs.rm(dest, { recursive: true, force: true });
  } catch {}
  if (depSpec.startsWith('file:')) {
    await fs.cp(src, dest, { recursive: true });
    console.log(colors.cyan(`Copied local dependency ${depName} from ${src}`));
  } else if (depSpec.startsWith('link:')) {
    try {
      await fs.symlink(src, dest, 'dir');
      console.log(colors.cyan(`Symlinked local dependency ${depName} from ${src}`));
    } catch (err) {
      if (err.code === 'EPERM' || err.code === 'EEXIST') {await fs.cp(src, dest, { recursive: true });
        console.log(colors.cyan(`Copied local dependency ${depName} from ${src} (symlink not permitted)`));
      } else {
        throw err;
      }
    }
  }
}

async function installTree(tree, destDir, options = {}) {const nodeModulesDir = path.join(destDir, 'node_modules');
  await fs.mkdir(nodeModulesDir, { recursive: true });
  const pkgs = Object.entries(tree);
  
  // Simple progress indicator that doesn't rely on string-width
  let currentIndex = 0;
  const totalPackages = pkgs.length;
  
  const updateProgress = (pkgName) => {
    currentIndex++;
    const percentage = Math.round((currentIndex / totalPackages) * 100);
    const progressBar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
    process.stdout.write(`\r[${progressBar}] ${percentage}% | ${currentIndex}/${totalPackages} | Installing ${pkgName}`);
    if (currentIndex === totalPackages) {process.stdout.write('\n');
    }
  };

  const concurrency = 8;
  let installedCount = 0;
  let skippedCount = 0;

  // Step 1: Resolve all tarball URLs in parallel
  const pkgsWithTarballs = await Promise.all(pkgs.map(async ([name, info]) => {
    if (info.version && (info.version.startsWith('file:') || info.version.startsWith('link:'))) {
      return { name, info, tarballMeta: { tarballUrl: null, shasum: null, integrity: null, signature: null } };
    }
    const tarballMeta = await getTarballUrl(name, info.version);
    return { name, info, tarballMeta };
  }));

  async function worker({ name, info, tarballMeta }) {updateProgress(name);
    
    // Handle file: and link: dependencies
    if (!tarballMeta.tarballUrl) {await handleLocalDep(name, info.version, nodeModulesDir);
      installedCount++;
      return;
    }
    
    const storePath = await ensureInStore(name, info.version, tarballMeta);
    const linkPath = path.join(nodeModulesDir, name);
    
    // Check if already installed and up-to-date
    const installedPkgJson = path.join(linkPath, 'package.json');
    let skip = false;
    try {
      const data = await fs.readFile(installedPkgJson, 'utf-8');
      const pkg = JSON.parse(data);
      if (pkg.version === info.version) {skip = true;
      }
    } catch {}
    
    if (skip) {// Already installed and up-to-date
      skippedCount++;
      return;
    }
    
    await safeRemove(linkPath);
    if (options.useSymlinks) {try {
        await fs.symlink(storePath, linkPath, 'dir');
      } catch (err) {
        await fs.cp(storePath, linkPath, { recursive: true });
      }
    } else {
      await fs.cp(storePath, linkPath, { recursive: true });
    }
    
    // Run lifecycle scripts
    const result = await runLifecycleScript(linkPath, 'preinstall', name);
    if (!result.success) {skippedCount++;
      return;
    }
    const installResult = await runLifecycleScript(linkPath, 'install', name);
    if (!installResult.success) {skippedCount++;
      return;
    }
    const postinstallResult = await runLifecycleScript(linkPath, 'postinstall', name);
    if (!postinstallResult.success) {skippedCount++;
      return;
    }
    
    installedCount++;
  }

  // Run workers in parallel with concurrency limit
  let idx = 0;
  async function runBatch() {const batch = [];
    for (let c = 0; c < concurrency && idx < pkgsWithTarballs.length; c++, idx++) {batch.push(worker(pkgsWithTarballs[idx]));
    }
    await Promise.all(batch);
    if (idx < pkgsWithTarballs.length) {await runBatch();
    }
  }
  await runBatch();
  
  return {
    installed: installedCount,
    skipped: skippedCount,
    total: pkgs.length
  };
}

module.exports = { installTree, runLifecycleScript }; 