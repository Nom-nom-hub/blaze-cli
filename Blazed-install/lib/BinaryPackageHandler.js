const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

// Binary package handler for packages like Playwright, Puppeteer, etc.
class BinaryPackageHandler {
  constructor() {this.binaryCacheDir = path.join(os.homedir(), '.blaze_binary_cache');
    this.knownBinaryPackages = new Set([
      'playwright',
      'puppeteer',
      '@playwright/test',
      'chromium',
      'electron',
      'sharp',
      'canvas',
      'sqlite3',
      'node-gyp'
    ]);
  }

  // Check if a package is a known binary package
  isBinaryPackage(packageName) {return this.knownBinaryPackages.has(packageName.toLowerCase());
  }

  // Handle binary package installation
  async handleBinaryPackage(packageDir, packageName) {
    console.log(`[DEBUG] Handling binary package: ${packageName}`);
    // Ensure binary cache directory exists
    await fs.mkdir(this.binaryCacheDir, { recursive: true });
    // For now, just run postinstall script if available
    const pkgPath = path.join(packageDir, 'package.json');
    try {
      const data = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(data);
      if (pkg.scripts && pkg.scripts.postinstall) {console.log(`[DEBUG] Running postinstall script for ${packageName}`);
        const result = await this.runPostinstallScript(packageDir, pkg.scripts.postinstall);
        return { success: true, postinstall: result };
      }
      return { success: true, message: 'No postinstall script found' };
    } catch (err) {
      console.warn(`[WARNING] Could not read package.json for ${packageName}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // Run postinstall script
  async runPostinstallScript(packageDir, script) {
    return new Promise((resolve) => {
      const child = spawn(process.platform === 'win32' ? 'cmd' : 'sh',
        [process.platform === 'win32' ? '/c' : '-c', script], {
        cwd: packageDir,
        stdio: 'inherit',
        shell: true,
        env: {
          ...process.env,
          PLAYWRIGHT_BROWSERS_PATH: path.join(this.binaryCacheDir, 'playwright'),
          PUPPETEER_CACHE_DIR: path.join(this.binaryCacheDir, 'puppeteer'),
          ELECTRON_CACHE: path.join(this.binaryCacheDir, 'electron')
        }
      });
      child.on('close', (code) => {
        if (code === 0) {resolve({ success: true, code: 0 });
        } else {
          resolve({ success: false, code, error: `Script failed with code ${code}` });
        }
      });
      child.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });
  }

  // Install binaries for a package
  async installBinaries(pkg, packageDir, nodeModulesDir) {
    // Stub: implement logic to install binaries
    // For now, mimic the test expectations
    if (!pkg.bin) return;
    const binDir = path.join(nodeModulesDir, '.bin');
    await fs.mkdir(binDir, { recursive: true });
    if (typeof pkg.bin === 'string') {
      await fs.copyFile(path.join(packageDir, pkg.bin), path.join(binDir, pkg.name));
      await fs.chmod(path.join(binDir, pkg.name), 0o755);
    } else if (typeof pkg.bin === 'object') {
      for (const [binName, binPath] of Object.entries(pkg.bin)) {
        await fs.copyFile(path.join(packageDir, binPath), path.join(binDir, binName));
        await fs.chmod(path.join(binDir, binName), 0o755);
      }
    }
  }

  // Create a binary script with shebang
  createBinaryScript(scriptPath) {
    return `#!/usr/bin/env node\nrequire('${scriptPath}')`;
  }

  // Get the binary path for a given binary name
  getBinaryPath(binName, nodeModulesDir) {
    const binDir = path.join(nodeModulesDir, '.bin');
    if (process.platform === 'win32') {
      return path.join(binDir, `${binName}.cmd`);
    } else {
      return path.join(binDir, binName);
    }
  }

  // Validate if a binary exists
  async validateBinary(binaryPath) {
    try {
      await fs.access(binaryPath, fs.constants.F_OK);
      return true;
    } catch (err) {
      return false;
    }
  }
}

module.exports = { BinaryPackageHandler }; 