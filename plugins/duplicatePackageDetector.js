const fs = require('fs');
const path = require('path');

function findDuplicates() {
  const nodeModules = path.join(process.cwd(), 'node_modules');
  if (!fs.existsSync(nodeModules)) return;
  const seen = {};
  const duplicates = {};

  function scan(dir) {
    const entries = fs.readdirSync(dir).filter(f => !f.startsWith('.'));
    for (const entry of entries) {
      const entryPath = path.join(dir, entry);
      if (entry.startsWith('@')) {
        scan(entryPath); // scoped packages
      } else {
        const pkgJson = path.join(entryPath, 'package.json');
        if (fs.existsSync(pkgJson)) {
          const data = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
          const key = data.name + '@' + data.version;
          if (!seen[data.name]) seen[data.name] = [];
          seen[data.name].push(data.version);
        }
      }
    }
  }

  scan(nodeModules);

  for (const name in seen) {
    const versions = Array.from(new Set(seen[name]));
    if (versions.length > 1) {
      duplicates[name] = versions;
    }
  }

  if (Object.keys(duplicates).length) {
    console.warn('[duplicatePackageDetector] Duplicate packages found:');
    for (const name in duplicates) {
      console.warn(`  - ${name}: ${duplicates[name].join(', ')}`);
    }
  } else {
    console.log('[duplicatePackageDetector] No duplicate packages found.');
  }
}

module.exports = {
  afterInstall: findDuplicates,
  afterUpdate: findDuplicates,
}; 