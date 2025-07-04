const fs = require('fs');
const path = require('path');

function getAllWorkspacePackages(rootDir) {
  const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
  const workspaces = rootPkg.workspaces || [];
  const pkgs = [];
  for (const ws of workspaces) {
    const wsPath = path.join(rootDir, ws);
    if (fs.existsSync(wsPath)) {
      const dirs = fs.readdirSync(wsPath);
      for (const dir of dirs) {
        const pkgPath = path.join(wsPath, dir, 'package.json');
        if (fs.existsSync(pkgPath)) {
          pkgs.push(pkgPath);
        }
      }
    }
  }
  return pkgs;
}

function getDeps(pkgPath) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  return { ...pkg.dependencies, ...pkg.devDependencies };
}

module.exports = {
  onCommand: ({ command }) => {
    if (command === 'install' || command === 'update') {
      const rootDir = process.cwd().split('packages')[0].replace(/\\$/, '');
      const pkgs = getAllWorkspacePackages(rootDir);
      const depMap = {};
      for (const pkgPath of pkgs) {
        const deps = getDeps(pkgPath);
        for (const [dep, ver] of Object.entries(deps)) {
          if (!depMap[dep]) depMap[dep] = [];
          depMap[dep].push({ pkg: pkgPath, ver });
        }
      }
      let hasConflicts = false;
      console.log('[monorepoCrossLinkChecker] Workspace dependency summary:');
      for (const [dep, arr] of Object.entries(depMap)) {
        const versions = new Set(arr.map(x => x.ver));
        if (versions.size > 1) {
          hasConflicts = true;
          console.log(`  - ${dep} has conflicting versions: ${Array.from(versions).join(', ')}`);
          arr.forEach(x => console.log(`      in ${x.pkg}`));
        }
      }
      if (!hasConflicts) {
        console.log('  No duplicate/conflicting dependencies found.');
      }
      // Unused/missing cross-links would require static analysis, which is advanced and can be added later.
    }
  },
};
