const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

async function writeLockfile(tree) {const lockPath = path.resolve(process.cwd(), 'blaze-lock.json');
  
  // Handle null or undefined tree
  const safeTree = tree || {};
  
  // Create a more sophisticated lockfile structure
  const lockfile = {
    version: '2.0.0',
    generated: new Date().toISOString(),
    integrity: null,
    packages: {},
    metadata: {
      totalPackages: Object.keys(safeTree).length,
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      blazeVersion: require('../package.json').version
    }
  };

  // Process each package
  for (const [name, info] of Object.entries(safeTree)) {
    lockfile.packages[name] = {
      version: info.version,
      dependencies: info.dependencies || {},
      peerDependencies: info.peerDependencies || {},
      optionalDependencies: info.optionalDependencies || {},
      integrity: info.integrity || null,
      tarballUrl: info.tarballUrl || null,
      parent: info.parent || null,
      resolved: info.resolved || null,
      // Add package-specific metadata
      metadata: {
        installed: new Date().toISOString(),
        platform: info.platform || null,
        arch: info.arch || null
      }
    };
  }

  // Calculate integrity hash of the entire lockfile
  const lockfileContent = JSON.stringify(lockfile.packages, null, 2);
  lockfile.integrity = crypto.createHash('sha256').update(lockfileContent).digest('hex');

  // Write the lockfile
  const data = JSON.stringify(lockfile, null, 2);
  await fs.writeFile(lockPath, data, 'utf-8');
}

module.exports = { writeLockfile }; 