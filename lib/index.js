const { readPackageJson } = require('./readPackageJson');
const { readLockfile } = require('./readLockfile');
const { resolveDependencies } = require('./resolveDependencies');
const { installTree, runLifecycleScript } = require('./installTree');
const { writeLockfile } = require('./writeLockfile');
const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const semver = require('semver');
const glob = require('glob');
const chalk = require('chalk').default;
const os = require('os');
const ini = require('ini');

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

function printHelp() {
  console.log(`\nblaze-install: A fast, modern alternative to npm install\n\nUsage:\n  blaze <command> [options]\n\nCommands:\n  install [package]      Install all or a specific package\n  uninstall <package>    Remove a package and prune lockfile\n  update <package>       Update a package to the latest version\n  audit                  Run a security audit\n  list                   List installed packages\n  clean                  Remove node_modules and cache\n  outdated               Show outdated dependencies\n  info <package>         Show info about a package\n  help, --help           Show this help message\n\nOptions:\n  --save-dev             Add to devDependencies\n  --production           Only install production dependencies\n  --symlink              Use symlinks instead of copying\n\nExamples:\n  blaze install\n  blaze install lodash\n  blaze uninstall lodash\n  blaze update lodash\n  blaze audit\n  blaze list\n  blaze clean\n  blaze outdated\n  blaze info lodash\n`);
}

async function loadBlazerc() {
  try {
    const configPath = path.join(process.cwd(), '.blazerc');
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// Plugin loader
async function loadPlugins() {
  const pluginsDir = path.join(process.cwd(), 'plugins');
  let plugins = [];
  try {
    const files = glob.sync('*.js', { cwd: pluginsDir, absolute: true });
    for (const file of files) {
      try {
        const plugin = require(file);
        plugins.push(plugin);
      } catch (err) {
        console.warn(`Failed to load plugin ${file}: ${err.message}`);
      }
    }
  } catch {}
  return plugins;
}

function readNpmrc() {
  const paths = [
    path.join(os.homedir(), '.npmrc'),
    path.join(process.cwd(), '.npmrc')
  ];
  let config = {};
  for (const p of paths) {
    try {
      const data = require('fs').readFileSync(p, 'utf-8');
      Object.assign(config, ini.parse(data));
    } catch {}
  }
  return config;
}

function getRegistryForPackage(pkgName, npmrc) {
  // Per-scope registry: @scope:registry=https://...
  const match = pkgName.match(/^@([^/]+)\//);
  if (match) {
    const scope = match[1];
    const scoped = npmrc[`@${scope}:registry`];
    if (scoped) return scoped;
  }
  return npmrc.registry || 'https://registry.npmjs.org/';
}

function getAuthForRegistry(registry, npmrc) {
  // Normalize registry URL for token lookup
  let reg = registry.replace(/^https?:/, '').replace(/\/$/, '');
  let token = npmrc[`//${reg}/:_authToken`] || npmrc[`//${reg}:_authToken`];
  if (!token && process.env.NPM_TOKEN) token = process.env.NPM_TOKEN;
  return token;
}

function getAxiosOptions(npmrc, registry) {
  const opts = {};
  if (npmrc.proxy) opts.proxy = npmrc.proxy;
  if (npmrc['strict-ssl'] === false || npmrc['strict-ssl'] === 'false') opts.httpsAgent = new (require('https').Agent)({ rejectUnauthorized: false });
  if (npmrc.ca) opts.ca = npmrc.ca;
  return opts;
}

async function publishPackage() {
  const config = readNpmrc();
  const pkg = await readPackageJson();
  const tar = require('tar');
  const axios = require('axios');
  const registry = getRegistryForPackage(pkg.name, config);
  const token = getAuthForRegistry(registry, config);
  const tarball = `${pkg.name}-${pkg.version}.tgz`;
  // Pack the package
  await tar.c({ gzip: true, file: tarball, cwd: process.cwd() }, ['.']);
  // Read tarball
  const data = require('fs').readFileSync(tarball);
  // Publish
  const url = `${registry.replace(/\/$/, '')}/${encodeURIComponent(pkg.name)}`;
  try {
    await axios.put(url, data, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Authorization': token ? `Bearer ${token}` : undefined
      }
    });
    console.log('Published to', url);
  } catch (err) {
    console.error('Publish failed:', err.response ? err.response.data : err.message);
  }
  require('fs').unlinkSync(tarball);
}

async function bumpVersion(newVersion) {
  const pkgPath = path.join(process.cwd(), 'package.json');
  const pkg = JSON.parse(require('fs').readFileSync(pkgPath, 'utf-8'));
  pkg.version = newVersion;
  require('fs').writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf-8');
  const { execSync } = require('child_process');
  execSync(`git add package.json`);
  execSync(`git commit -m "chore: bump version to ${newVersion}"`);
  execSync(`git tag v${newVersion}`);
  console.log(`Version bumped to ${newVersion} and git tag created.`);
}

async function auditAndFix() {
  const lock = await readLockfile();
  if (!lock) {
    console.log('No blaze-lock.json found. Run blaze install first.');
    return;
  }
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
    const { data } = await require('axios').post('https://registry.npmjs.org/-/npm/v1/security/audits', payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (data.advisories && Object.keys(data.advisories).length > 0) {
      let updated = false;
      const pkg = await readPackageJson();
      for (const key in data.advisories) {
        const advisory = data.advisories[key];
        const dep = advisory.module_name;
        const latest = advisory.patched_versions.replace(/[<>=^~| ]/g, '').split(',').pop();
        if (pkg.dependencies && pkg.dependencies[dep]) {
          pkg.dependencies[dep] = `^${latest}`;
          updated = true;
          console.log(`Updated ${dep} to ^${latest}`);
        }
        if (pkg.devDependencies && pkg.devDependencies[dep]) {
          pkg.devDependencies[dep] = `^${latest}`;
          updated = true;
          console.log(`Updated ${dep} to ^${latest}`);
        }
      }
      if (updated) {
        require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2), 'utf-8');
        console.log('Reinstalling dependencies...');
        require('child_process').execSync('npm install', { stdio: 'inherit' });
        console.log('Dependencies updated and reinstalled.');
      } else {
        console.log('No updatable vulnerable dependencies found.');
      }
    } else {
      console.log('No vulnerable dependencies found.');
    }
  } catch (err) {
    console.warn(`Could not audit: ${err.message}`);
  }
}

async function runScript(scriptName) {
  const pkgDir = process.cwd();
  const pkg = await readPackageJson();
  if (pkg.scripts && pkg.scripts[scriptName]) {
    await runLifecycleScript(pkgDir, scriptName, pkg.name);
  } else {
    console.log(`No script named '${scriptName}' in package.json.`);
  }
}

const GLOBAL_LINKS_DIR = path.join(os.homedir(), '.blaze-links');

async function blazeLink() {
  const pkg = await readPackageJson();
  await fs.mkdir(GLOBAL_LINKS_DIR, { recursive: true });
  const linkPath = path.join(GLOBAL_LINKS_DIR, pkg.name);
  try {
    await fs.rm(linkPath, { recursive: true, force: true });
  } catch {}
  try {
    await fs.symlink(process.cwd(), linkPath, 'dir');
    console.log(`Linked ${pkg.name} globally at ${linkPath}`);
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EEXIST') {
      await fs.cp(process.cwd(), linkPath, { recursive: true });
      console.log(`Copied ${pkg.name} globally at ${linkPath} (symlink not permitted)`);
    } else {
      throw err;
    }
  }
}

async function blazeUnlink() {
  const pkg = await readPackageJson();
  const linkPath = path.join(GLOBAL_LINKS_DIR, pkg.name);
  try {
    await fs.rm(linkPath, { recursive: true, force: true });
    console.log(`Unlinked ${pkg.name} from global links.`);
  } catch {
    console.log(`No global link found for ${pkg.name}.`);
  }
}

async function blazeLinkInstall(pkgName) {
  // Link a globally linked package into node_modules
  await fs.mkdir('node_modules', { recursive: true });
  const linkPath = path.join(GLOBAL_LINKS_DIR, pkgName);
  const dest = path.join(process.cwd(), 'node_modules', pkgName);
  try {
    await fs.rm(dest, { recursive: true, force: true });
  } catch {}
  try {
    await fs.symlink(linkPath, dest, 'dir');
    console.log(`Linked ${pkgName} into node_modules.`);
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EEXIST') {
      await fs.cp(linkPath, dest, { recursive: true });
      console.log(`Copied ${pkgName} into node_modules (symlink not permitted)`);
    } else {
      throw err;
    }
  }
}

async function main(args) {
  try {
    // Load plugins
    const plugins = await loadPlugins();
    // Interactive mode if --interactive is given
    if (args[0] === '--interactive') {
      const inquirer = (await import('inquirer')).default;
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: 'Install a package', value: 'install' },
            { name: 'Uninstall a package', value: 'uninstall' },
            { name: 'Update a package', value: 'update' },
            { name: 'Audit dependencies', value: 'audit' },
            { name: 'List installed packages', value: 'list' },
            { name: 'Clean node_modules and cache', value: 'clean' },
            { name: 'Show outdated dependencies', value: 'outdated' },
            { name: 'Show info about a package', value: 'info' },
            { name: 'Exit', value: 'exit' }
          ]
        }
      ]);
      if (action === 'exit') return;
      let pkgName = '';
      if (['install', 'uninstall', 'update', 'info'].includes(action)) {
        const answer = await inquirer.prompt([
          {
            type: 'input',
            name: 'pkg',
            message: `Package name:`,
            when: () => action !== 'install' || true
          }
        ]);
        pkgName = answer.pkg;
      }
      // Re-run main with the selected action and package name
      if (pkgName) {
        await main([action, pkgName]);
      } else {
        await main([action]);
      }
      return;
    }
    const command = args[0];
    const rest = args.slice(1);
    // Load config from .blazerc
    const config = await loadBlazerc();
    // Merge CLI flags with config (CLI flags take precedence)
    const useSymlinks = args.includes('--symlink') || config.symlink;
    const production = args.includes('--production') || config.production;
    const saveDev = args.includes('--save-dev') || config.saveDev;
    // Remove config flags from args for command parsing
    const filteredArgs = args.filter(a => a !== '--symlink' && a !== '--production' && a !== '--save-dev');
    // Plugin onCommand hook
    for (const plugin of plugins) {
      if (typeof plugin.onCommand === 'function') {
        await plugin.onCommand({ command, args, context: { cwd: process.cwd() } });
      }
    }
    if (command === 'audit') {
      const jsonOutput = args.includes('--json');
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
        if (jsonOutput) {
          console.log(JSON.stringify(data, null, 2));
          return;
        }
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
            if (advisory.recommendation) {
              console.log(chalk.cyan(`  Recommendation: ${advisory.recommendation}`));
            }
            if (advisory.module_name) {
              console.log(chalk.cyan(`  To attempt a fix: run blaze update ${advisory.module_name}`));
            }
            console.log();
          }
          console.log(chalk.red.bold(`Found ${found} vulnerable packages!`));
        } else {
          console.log(chalk.green('No known vulnerabilities found!'));
        }
      } catch (err) {
        console.warn(`Could not audit: ${err.message}`);
      }
      return;
    }
    if (command === 'audit' && rest[0] === 'fix') {
      await auditAndFix();
      return;
    }
    if (command === 'uninstall') {
      if (rest.length === 0) {
        console.log('Usage: blaze uninstall <package>');
        process.exit(1);
      }
      // Run preuninstall/uninstall/postuninstall scripts
      const pkgDir = path.join(process.cwd(), 'node_modules', rest[0]);
      await runLifecycleScript(pkgDir, 'preuninstall', rest[0]);
      await runLifecycleScript(pkgDir, 'uninstall', rest[0]);
      await uninstallPackage(rest[0]);
      await runLifecycleScript(pkgDir, 'postuninstall', rest[0]);
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
    if (command === 'list') {
      const pkg = await readPackageJson();
      const deps = pkg.dependencies || {};
      const devDeps = pkg.devDependencies || {};
      console.log(chalk.bold('\nInstalled dependencies:'));
      if (Object.keys(deps).length === 0) {
        console.log(chalk.gray('  (none)'));
      } else {
        for (const [name, version] of Object.entries(deps)) {
          console.log(chalk.green(`  ${name}@${version}`));
        }
      }
      console.log(chalk.bold('\nInstalled devDependencies:'));
      if (Object.keys(devDeps).length === 0) {
        console.log(chalk.gray('  (none)'));
      } else {
        for (const [name, version] of Object.entries(devDeps)) {
          console.log(chalk.cyan(`  ${name}@${version}`));
        }
      }
      console.log();
      return;
    }
    if (command === 'clean') {
      let removed = false;
      async function tryRemove(target) {
        try {
          await fs.rm(target, { recursive: true, force: true });
          console.log(chalk.green(`Removed ${target}`));
          removed = true;
        } catch (err) {
          // Only print if not ENOENT
          if (err.code !== 'ENOENT') {
            console.log(chalk.red(`Failed to remove ${target}: ${err.message}`));
          }
        }
      }
      await tryRemove(path.join(process.cwd(), 'node_modules'));
      await tryRemove(path.join(process.cwd(), '.cache'));
      await tryRemove(path.join(process.cwd(), 'node_modules', '.cache'));
      if (!removed) {
        console.log(chalk.yellow('Nothing to clean.'));
      }
      return;
    }
    if (command === 'outdated') {
      const pkg = await readPackageJson();
      const deps = pkg.dependencies || {};
      const devDeps = pkg.devDependencies || {};
      const all = { ...deps, ...devDeps };
      const chalk = require('chalk').default;
      const axios = require('axios');
      const semver = require('semver');
      const pad = (str, len) => str + ' '.repeat(Math.max(0, len - str.length));
      if (Object.keys(all).length === 0) {
        console.log(chalk.yellow('No dependencies found.'));
        return;
      }
      console.log(chalk.bold('\nOutdated dependencies:'));
      console.log(pad('Package', 25) + pad('Current', 15) + pad('Latest', 15) + 'Status');
      for (const [name, current] of Object.entries(all)) {
        try {
          const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
          const { data } = await axios.get(url);
          const latest = data['dist-tags'].latest;
          let status = '';
          if (semver.validRange(current) && semver.lt(semver.minVersion(current), latest)) {
            status = chalk.red('Outdated');
          } else {
            status = chalk.green('Up to date');
          }
          console.log(pad(name, 25) + pad(current, 15) + pad(latest, 15) + status);
        } catch (err) {
          console.log(pad(name, 25) + pad(current, 15) + pad('-', 15) + chalk.yellow('Error fetching latest'));
        }
      }
      console.log();
      return;
    }
    if (command === 'info') {
      const chalk = require('chalk').default;
      const axios = require('axios');
      if (!rest[0]) {
        console.log('Usage: blaze info <package>');
        return;
      }
      const pkgName = rest[0];
      try {
        const url = `https://registry.npmjs.org/${encodeURIComponent(pkgName)}`;
        const { data } = await axios.get(url);
        const latest = data['dist-tags'].latest;
        const info = data.versions[latest];
        console.log(chalk.bold(`\n${pkgName}`));
        console.log(chalk.green('Latest version:'), latest);
        if (info.description) console.log(chalk.green('Description:'), info.description);
        if (info.homepage) console.log(chalk.green('Homepage:'), info.homepage);
        if (info.repository && info.repository.url) console.log(chalk.green('Repository:'), info.repository.url.replace(/^git\+/, ''));
        if (info.license) console.log(chalk.green('License:'), info.license);
        if (info.maintainers) {
          const maintainers = Array.isArray(info.maintainers) ? info.maintainers.map(m => m.name).join(', ') : info.maintainers;
          console.log(chalk.green('Maintainers:'), maintainers);
        }
        console.log();
      } catch (err) {
        console.log(chalk.red('Error fetching info for'), pkgName, '-', err.message);
      }
      return;
    }
    if (command === 'publish') {
      // Run prepublish, prepare, prepack, postpack, postpublish scripts
      await runLifecycleScript(process.cwd(), 'prepublish', '');
      await runLifecycleScript(process.cwd(), 'prepare', '');
      await runLifecycleScript(process.cwd(), 'prepack', '');
      await publishPackage();
      await runLifecycleScript(process.cwd(), 'postpack', '');
      await runLifecycleScript(process.cwd(), 'postpublish', '');
      return;
    }
    if (command === 'version') {
      if (!rest[0]) {
        console.log('Usage: blaze version <newversion>');
        return;
      }
      // Run preversion, version, postversion scripts
      await runLifecycleScript(process.cwd(), 'preversion', '');
      await bumpVersion(rest[0]);
      await runLifecycleScript(process.cwd(), 'version', '');
      await runLifecycleScript(process.cwd(), 'postversion', '');
      return;
    }
    if (command === 'run') {
      if (!rest[0]) {
        console.log('Usage: blaze run <script>');
        return;
      }
      await runScript(rest[0]);
      return;
    }
    if (command === 'link') {
      if (rest[0]) {
        await blazeLinkInstall(rest[0]);
      } else {
        await blazeLink();
      }
      return;
    }
    if (command === 'unlink') {
      await blazeUnlink();
      return;
    }
    console.log('Welcome to blaze-install!');
    console.log('Arguments:', args);
    if (command === 'install' || command === undefined) {
      // Plugin beforeInstall hook
      for (const plugin of plugins) {
        if (typeof plugin.beforeInstall === 'function') {
          await plugin.beforeInstall({ args, context: { cwd: process.cwd() } });
        }
      }
      // Parse and add a package if specified
      if (filteredArgs.length > 1) {
        const { name: pkgName, range } = parsePackageArg(filteredArgs[1]);
        const versionOrRange = await resolveVersionOrRange(pkgName, range);
        await addDependencyToPackageJson(pkgName, versionOrRange, saveDev);
      }
      const pkg = await readPackageJson();
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
      // Check for file:/link: deps
      const hasLocalDeps = Object.values(depsToInstall).some(v => typeof v === 'string' && (v.startsWith('file:') || v.startsWith('link:')));
      const lock = hasLocalDeps ? null : await readLockfile();
      if (lock) {
        if (Object.keys(lock).length === 0) {
          console.log('No dependencies to install. Skipping install.');
          return;
        }
        console.log('blaze-lock.json found. Installing from lockfile...');
        await installTree(lock, process.cwd(), { useSymlinks });
        console.log('All packages installed from lockfile!');
      } else {
        console.log('No blaze-lock.json found or local dependencies present. Resolving dependencies...');
        if (Object.keys(depsToInstall).length > 0) {
          const tree = await resolveDependencies(depsToInstall);
          console.log('Resolved dependency tree:', tree);
          // Debug: check for my-local-pkg
          if (tree['my-local-pkg']) {
            console.log('DEBUG: my-local-pkg is present in the resolved tree:', tree['my-local-pkg']);
          } else {
            console.log('DEBUG: my-local-pkg is NOT present in the resolved tree');
          }
          console.log('Installing packages...');
          await installTree(tree, process.cwd(), { useSymlinks });
          console.log('All packages installed!');
          await writeLockfile(tree);
          console.log('blaze-lock.json written!');
        } else {
          console.log('No dependencies found in package.json.');
        }
      }
      // Plugin afterInstall hook
      for (const plugin of plugins) {
        if (typeof plugin.afterInstall === 'function') {
          await plugin.afterInstall({ args, context: { cwd: process.cwd() } });
        }
      }
      return;
    }
  } catch (err) {
    console.error(chalk.red('Error:'), err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

module.exports = { main, printHelp }; 