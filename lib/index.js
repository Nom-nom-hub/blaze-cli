const { readPackageJson } = require('./readPackageJson');
const { readLockfile } = require('./readLockfile');
const { resolveDependencies } = require('./resolveDependencies');
const { installTree } = require('./installTree');
const { writeLockfile } = require('./writeLockfile');
const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const semver = require('semver');
const glob = require('glob');
const chalk = require('chalk').default;

function parsePackageArg(arg) {
  // e.g. lodash@4.17.21 or lodash@^4.17.0 or lodash@next
  const match = arg.match(/^(@?[^@]+)(?:@(.+))?$/);
  if (!match) return { name: arg, range: undefined };
  return { name: match[1], range: match[2] };
}

async function resolveVersionOrRange(pkgName, rangeOrTag) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(pkgName)}`;
  const { data } = await axios.get(url);
  if (!rangeOrTag || rangeOrTag === 'latest') {
    return `^${data['dist-tags'].latest}`;
  }
  // If it's a known tag
  if (data['dist-tags'][rangeOrTag]) {
    return `^${data['dist-tags'][rangeOrTag]}`;
  }
  // If it's a semver range, resolve to the max satisfying version
  const versions = Object.keys(data.versions);
  const max = semver.maxSatisfying(versions, rangeOrTag);
  if (max) {
    return rangeOrTag; // keep the range in package.json
  }
  // If it's not a valid semver or tag, show error
  console.error(`Unknown tag or invalid version/range: '${rangeOrTag}' for package '${pkgName}'.`);
  process.exit(1);
}

async function addDependencyToPackageJson(pkgName, versionOrRange, dev) {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  const pkg = await readPackageJson();
  if (dev) {
    pkg.devDependencies = pkg.devDependencies || {};
    pkg.devDependencies[pkgName] = versionOrRange;
    console.log(`Added ${pkgName}@${versionOrRange} to devDependencies in package.json.`);
  } else {
    pkg.dependencies = pkg.dependencies || {};
    pkg.dependencies[pkgName] = versionOrRange;
    console.log(`Added ${pkgName}@${versionOrRange} to dependencies in package.json.`);
  }
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2), 'utf-8');
}

async function readWorkspacePackageJsons(workspaces) {
  const allDeps = {};
  const allDevDeps = {};
  const workspacePaths = [];
  for (const pattern of workspaces) {
    const matches = glob.sync(pattern, { cwd: process.cwd(), absolute: true });
    for (const wsPath of matches) {
      const pkgPath = path.join(wsPath, 'package.json');
      try {
        const data = await fs.readFile(pkgPath, 'utf-8');
        const pkg = JSON.parse(data);
        Object.assign(allDeps, pkg.dependencies || {});
        Object.assign(allDevDeps, pkg.devDependencies || {});
        workspacePaths.push(wsPath);
      } catch {}
    }
  }
  return { allDeps, allDevDeps, workspacePaths };
}

async function fetchLatestVersion(pkgName) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(pkgName)}`;
  const { data } = await axios.get(url);
  return data['dist-tags'].latest;
}

async function uninstallPackage(pkgName) {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  const pkg = await readPackageJson();
  let removed = false;
  if (pkg.dependencies && pkg.dependencies[pkgName]) {
    delete pkg.dependencies[pkgName];
    removed = true;
  }
  if (pkg.devDependencies && pkg.devDependencies[pkgName]) {
    delete pkg.devDependencies[pkgName];
    removed = true;
  }
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2), 'utf-8');
  // Remove from node_modules
  const modPath = path.join(process.cwd(), 'node_modules', pkgName);
  try {
    await fs.rm(modPath, { recursive: true, force: true });
  } catch {}
  if (removed) {
    console.log(`Uninstalled ${pkgName}.`);
  } else {
    console.log(`${pkgName} was not found in dependencies.`);
  }
}

async function updatePackage(pkgName, dev) {
  const versionOrRange = `^${await fetchLatestVersion(pkgName)}`;
  await addDependencyToPackageJson(pkgName, versionOrRange, dev);
  console.log(`Updated ${pkgName} to ${versionOrRange}.`);
}

async function auditPackages() {
  const lock = await readLockfile();
  if (!lock) {
    console.log('No blaze-lock.json found. Run blaze install first.');
    return;
  }
  // Build dependencies object in npm audit format
  const dependencies = {};
  for (const [name, info] of Object.entries(lock)) {
    dependencies[name] = { version: info.version };
  }
  const payload = {
    name: 'blaze-install',
    version: '0.0.0',
    dependencies
  };
  try {
    const { data } = await axios.post('https://registry.npmjs.org/-/npm/v1/security/audits', payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (data.metadata && data.metadata.vulnerabilities && data.metadata.vulnerabilities.total === 0) {
      console.log(chalk.green('No known vulnerabilities found!'));
      return;
    }
    if (data.advisories) {
      let found = 0;
      for (const key in data.advisories) {
        const advisory = data.advisories[key];
        found++;
        console.log(chalk.red.bold(`VULNERABILITY: ${advisory.module_name}@${advisory.findings[0].version}`));
        console.log(chalk.red(`  Severity: ${advisory.severity}`));
        console.log(chalk.yellow(`  Title: ${advisory.title}`));
        console.log(chalk.gray(`  URL: ${advisory.url}`));
        console.log(chalk.gray(`  Vulnerable: ${advisory.vulnerable_versions}`));
        console.log();
      }
      console.log(chalk.red.bold(`Found ${found} vulnerable packages!`));
    } else {
      console.log(chalk.green('No known vulnerabilities found!'));
    }
  } catch (err) {
    console.warn(`Could not audit: ${err.message}`);
  }
}

async function pruneLockfile() {
  const { readLockfile } = require('./readLockfile');
  const { writeLockfile } = require('./writeLockfile');
  const { resolveDependencies } = require('./resolveDependencies');
  const pkg = await readPackageJson();
  const deps = pkg.dependencies || {};
  const devDeps = pkg.devDependencies || {};
  const allDeps = { ...deps, ...devDeps };
  if (Object.keys(allDeps).length === 0) {
    await writeLockfile({});
    return;
  }
  const prunedTree = await resolveDependencies(allDeps);
  await writeLockfile(prunedTree);
}

async function main(args) {
  try {
    const command = args[0];
    const rest = args.slice(1);
    if (command === 'audit') {
      await auditPackages();
      return;
    }
    if (command === 'uninstall') {
      if (rest.length === 0) {
        console.log('Usage: blaze uninstall <package>');
        process.exit(1);
      }
      await uninstallPackage(rest[0]);
      await pruneLockfile();
      // Add a short delay to avoid race conditions on Windows
      await new Promise(resolve => setTimeout(resolve, 500));
      await main(['install']);
      return;
    }
    if (command === 'update') {
      if (rest.length === 0) {
        console.log('Usage: blaze update <package>');
        process.exit(1);
      }
      const pkg = await readPackageJson();
      const dev = pkg.devDependencies && pkg.devDependencies[rest[0]];
      await updatePackage(rest[0], dev);
      await main(['install']);
      return;
    }
    console.log('Welcome to blaze-install!');
    console.log('Arguments:', args);
    const useSymlinks = args.includes('--symlink');
    const production = args.includes('--production');
    const saveDev = args.includes('--save-dev');
    const filteredArgs = args.filter(a => a !== '--symlink' && a !== '--production' && a !== '--save-dev');
    if (filteredArgs.length > 0) {
      const { name: pkgName, range } = parsePackageArg(filteredArgs[0]);
      const versionOrRange = await resolveVersionOrRange(pkgName, range);
      await addDependencyToPackageJson(pkgName, versionOrRange, saveDev);
    }
    const pkg = await readPackageJson();
    console.log('package.json:', pkg);
    let depsToInstall = {};
    let workspacePaths = [];
    if (pkg.workspaces && Array.isArray(pkg.workspaces)) {
      console.log('Detected workspaces:', pkg.workspaces);
      const { allDeps, allDevDeps, workspacePaths: wsPaths } = await readWorkspacePackageJsons(pkg.workspaces);
      workspacePaths = wsPaths;
      if (production) {
        depsToInstall = { ...(pkg.dependencies || {}), ...allDeps };
      } else {
        depsToInstall = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}), ...allDeps, ...allDevDeps };
      }
    } else {
      if (production) {
        depsToInstall = pkg.dependencies || {};
      } else {
        depsToInstall = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      }
    }
    const lock = await readLockfile();
    if (lock) {
      if (Object.keys(lock).length === 0) {
        console.log('No dependencies to install. Skipping install.');
        return;
      }
      console.log('blaze-lock.json found. Installing from lockfile...');
      await installTree(lock, process.cwd(), { useSymlinks });
      console.log('All packages installed from lockfile!');
    } else {
      console.log('No blaze-lock.json found. Resolving dependencies...');
      if (Object.keys(depsToInstall).length > 0) {
        const tree = await resolveDependencies(depsToInstall);
        console.log('Resolved dependency tree:', tree);
        console.log('Installing packages...');
        await installTree(tree, process.cwd(), { useSymlinks });
        console.log('All packages installed!');
        await writeLockfile(tree);
        console.log('blaze-lock.json written!');
      } else {
        console.log('No dependencies found in package.json.');
      }
    }
  } catch (err) {
    console.error(chalk.red('Error:'), err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

module.exports = { main }; 