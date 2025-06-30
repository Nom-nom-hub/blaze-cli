const { readPackageJson } = require('./readPackageJson');
const { readLockfile } = require('./readLockfile');
const { resolveDependencies, getCurrentPlatform } = require('./resolveDependencies');
const { installTree, runLifecycleScript } = require('./installTree');
const { writeLockfile } = require('./writeLockfile');
const { WorkspaceResolver } = require('./workspaceResolver');
const { PeerDependencyResolver } = require('./peerDependencyResolver');
const { BinaryPackageHandler } = require('./BinaryPackageHandler');
const RegistryMirror = require('./registryMirror');
const PackageSigning = require('./packageSigning');
const MigrationTools = require('./migrationTools');
const PerformanceProfiler = require('./performanceProfiler');
const registryService = require('./registryService');
const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const semver = require('semver');
const glob = require('glob');
const { spawn } = require('child_process');
const os = require('os');
const chalk = require('chalk');

// Initialize enterprise modules
const registryMirror = new RegistryMirror();
const packageSigning = new PackageSigning();
const migrationTools = new MigrationTools();
const performanceProfiler = new PerformanceProfiler();

let plugins = [];

function parsePackageArg(arg) {// e.g. lodash@4.17.21 or lodash@^4.17.0 or lodash@next
  const match = arg.match(/^(@?[^@]+)(?:@(.+))?$/);
  if (!match) return { name: arg, range: undefined };
  return { name: match[1], range: match[2] };
}

async function resolveVersionOrRange(pkgName, rangeOrTag, { offline = false } = {}) {if (offline) {// Try to resolve from local package.json or lockfile
    let pkg, lock;
    try {
      pkg = JSON.parse(await fs.readFile('package.json', 'utf-8'));
    } catch {}
    try {
      lock = JSON.parse(await fs.readFile('blaze-lock.json', 'utf-8'));
    } catch {}
    // Prefer lockfile
    if (lock && lock[pkgName]) {return `^${lock[pkgName].version || lock[pkgName]}`;
    }
    if (pkg && pkg.dependencies && pkg.dependencies[pkgName]) {return pkg.dependencies[pkgName];
    }
    if (pkg && pkg.devDependencies && pkg.devDependencies[pkgName]) {return pkg.devDependencies[pkgName];
    }
    throw new Error(`Offline mode: Cannot resolve version for ${pkgName}. Not found in local package.json or lockfile.`);
  }
  
  // Use registry service instead of hardcoded URL
  const data = await registryService.getPackageMetadata(pkgName);
  
  if (!rangeOrTag || rangeOrTag === 'latest') {return `^${data['dist-tags'].latest}`;
  }
  // If it's a known tag
  if (data['dist-tags'][rangeOrTag]) {return `^${data['dist-tags'][rangeOrTag]}`;
  }
  // If it's a semver range, resolve to the max satisfying version
  const versions = Object.keys(data.versions);
  const max = semver.maxSatisfying(versions, rangeOrTag);
  if (max) {return rangeOrTag; // keep the range in package.json
  }
  // If it's not a valid semver or tag, show error
  console.error(`Unknown tag or invalid version/range: '${rangeOrTag}' for package '${pkgName}'.`);
  process.exit(1);
}

async function addDependencyToPackageJson(pkgName, versionOrRange, dev) {const pkgPath = path.resolve(process.cwd(), 'package.json');
  const pkg = await readPackageJson();
  if (dev) {pkg.devDependencies = pkg.devDependencies || {};
    pkg.devDependencies[pkgName] = versionOrRange;
    console.log(`Added ${pkgName}@${versionOrRange} to devDependencies in package.json.`);
  } else {
    pkg.dependencies = pkg.dependencies || {};
    pkg.dependencies[pkgName] = versionOrRange;
    console.log(`Added ${pkgName}@${versionOrRange} to dependencies in package.json.`);
  }
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2), 'utf-8');
}

async function readWorkspacePackageJsons(workspaces) {const allDeps = {};
  const allDevDeps = {};
  const workspacePaths = [];
  for (const pattern of workspaces) {const matches = glob.sync(pattern, { cwd: process.cwd(), absolute: true });
    for (const wsPath of matches) {const pkgPath = path.join(wsPath, 'package.json');
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

async function fetchLatestVersion(pkgName) {// Use registry service instead of hardcoded URL
  const data = await registryService.getPackageMetadata(pkgName);
  return data['dist-tags'].latest;
}

async function uninstallPackage(pkgName) {const pkgPath = path.resolve(process.cwd(), 'package.json');
  const pkg = await readPackageJson();
  let removed = false;
  if (pkg.dependencies && pkg.dependencies[pkgName]) {delete pkg.dependencies[pkgName];
    removed = true;
  }
  if (pkg.devDependencies && pkg.devDependencies[pkgName]) {delete pkg.devDependencies[pkgName];
    removed = true;
  }
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2), 'utf-8');
  // Remove from node_modules
  const modPath = path.join(process.cwd(), 'node_modules', pkgName);
  try {
    await fs.rm(modPath, { recursive: true, force: true });
  } catch {}
  if (removed) {console.log(`Uninstalled ${pkgName}.`);
  } else {
    console.log(`${pkgName} was not found in dependencies.`);
  }
}

async function updatePackage(pkgName, dev) {const versionOrRange = `^${await fetchLatestVersion(pkgName)}`;
  await addDependencyToPackageJson(pkgName, versionOrRange, dev);
  console.log(`Updated ${pkgName} to ${versionOrRange}.`);
}

async function auditPackages() {// Plugin hook
  for (const plugin of plugins) {if (typeof plugin.beforeAudit === 'function') {
      await plugin.beforeAudit({ context: { cwd: process.cwd() } });
    }
  }
  const lock = await readLockfile();
  if (!lock) {console.log('No blaze-lock.json found. Run blaze install first.');
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
    // Use registry service instead of hardcoded URL
    const data = await registryService.audit(payload);
    
    if (data.metadata && data.metadata.vulnerabilities && data.metadata.vulnerabilities.total === 0) {console.log(chalk.green('No known vulnerabilities found!'));
      return;
    }
    if (data.advisories) {let found = 0;
      for (const key in data.advisories) {const advisory = data.advisories[key];
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
  // Plugin hook
}

async function pruneLockfile() {const { readLockfile } = require('./readLockfile');
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
  await writeLockfile(prunedTree.tree);
}

function printHelp() {console.log(`\nblaze-install: A fast, modern alternative to npm install\n\nUsage:\n  blaze <command> [options]\n\nCommands:\n  install [package]      Install all or a specific package\n  uninstall <package>    Remove a package and prune lockfile\n  update <package>       Update a package to the latest version\n  audit                  Run a security audit\n  list                   List installed packages\n  clean                  Remove node_modules and cache\n  outdated               Show outdated dependencies\n  info <package>         Show info about a package\n  graph                  Generate a dependency graph\n  help, --help           Show this help message\n  prefetch               Prefetch/cache all dependencies for offline use\n\nEnterprise Commands:\n  migrate                Migrate from npm/yarn/pnpm lockfiles\n  validate               Validate package.json for issues\n  profile <start|stop|save> Performance profiling and analysis\n  registry status        Show registry mirror status\n  signing <keys|add-key> Manage package signing keys\n\nOptions:\n  --save-dev             Add to devDependencies\n  --production           Only install production dependencies\n  --symlink              Use symlinks instead of copying\n  --audit-fix            Run a security audit and fix after install\n  --no-lockfile          Do not use or write blaze-lock.json (lockfile-less mode)\n  --ci                   Remove node_modules before install (like npm ci)\n  --offline              Use only local cache for installs\n  --doctor               Diagnose and fix common project issues\n\nExamples:\n  blaze install\n  blaze install lodash\n  blaze install --audit-fix\n  blaze install --no-lockfile\n  blaze install --ci\n  blaze uninstall lodash\n  blaze update lodash\n  blaze audit\n  blaze list\n  blaze clean\n  blaze outdated\n  blaze info lodash\n  blaze graph\n  blaze install [pkg] [--offline]\n  blaze doctor\n  blaze prefetch\n  blaze migrate\n  blaze validate\n  blaze profile start\n  blaze profile stop\n  blaze registry status\n  blaze signing keys\n`);
}

async function loadBlazerc() {try {
    const configPath = path.join(process.cwd(), '.blazerc');
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// Plugin loader
async function loadPlugins() {const pluginsDir = path.join(process.cwd(), 'plugins');
  let plugins = [];
  try {
    const files = glob.sync('*.js', { cwd: pluginsDir, absolute: true });
    for (const file of files) {try {
        const plugin = require(file);
        plugins.push(plugin);
      } catch (err) {
        console.warn(`Failed to load plugin ${file}: ${err.message}`);
      }
    }
  } catch {}
  return plugins;
}

function readNpmrc() {const paths = [
    path.join(os.homedir(), '.npmrc'),
    path.join(process.cwd(), '.npmrc')
  ];
  let config = {};
  for (const p of paths) {try {
      const data = require('fs').readFileSync(p, 'utf-8');
      Object.assign(config, ini.parse(data));
    } catch {}
  }
  return config;
}

function getRegistryForPackage(pkgName, npmrc) {// Per-scope registry: @scope:registry=https://...
  const match = pkgName.match(/^@([^/]+)\//);
  if (match) {const scope = match[1];
    const scoped = npmrc[`@${scope}:registry`];
    if (scoped) return scoped;
  }
  return npmrc.registry || 'https://registry.npmjs.org/';
}

function getAuthForRegistry(registry, npmrc) {// Normalize registry URL for token lookup
  let reg = registry.replace(/^https?:/, '').replace(/\/$/, '');
  let token = npmrc[`//${reg}/:_authToken`] || npmrc[`//${reg}:_authToken`];
  if (!token && process.env.NPM_TOKEN) token = process.env.NPM_TOKEN;
  return token;
}

function getAxiosOptions(npmrc, registry) {const opts = {};
  if (npmrc.proxy) opts.proxy = npmrc.proxy;
  if (npmrc['strict-ssl'] === false || npmrc['strict-ssl'] === 'false') opts.httpsAgent = new (require('https').Agent)({ rejectUnauthorized: false });
  if (npmrc.ca) opts.ca = npmrc.ca;
  return opts;
}

async function publishPackage() {const config = readNpmrc();
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

async function bumpVersion(newVersion) {const pkgPath = path.join(process.cwd(), 'package.json');
  const pkg = JSON.parse(require('fs').readFileSync(pkgPath, 'utf-8'));
  pkg.version = newVersion;
  require('fs').writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf-8');
  const { execSync } = require('child_process');
  execSync(`git add package.json`);
  execSync(`git commit -m "chore: bump version to ${newVersion}"`);
  execSync(`git tag v${newVersion}`);
  console.log(`Version bumped to ${newVersion} and git tag created.`);
}

async function auditAndFix() {const lock = await readLockfile();
  if (!lock) {console.log('No blaze-lock.json found. Run blaze install first.');
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
      for (const key in data.advisories) {const advisory = data.advisories[key];
        const dep = advisory.module_name;
        const latest = advisory.patched_versions.replace(/[<>=^~| ]/g, '').split(',').pop();
        if (pkg.dependencies && pkg.dependencies[dep]) {pkg.dependencies[dep] = `^${latest}`;
          updated = true;
          console.log(`Updated ${dep} to ^${latest}`);
        }
        if (pkg.devDependencies && pkg.devDependencies[dep]) {pkg.devDependencies[dep] = `^${latest}`;
          updated = true;
          console.log(`Updated ${dep} to ^${latest}`);
        }
      }
      if (updated) {require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2), 'utf-8');
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

async function runScript(scriptName) {const pkgDir = process.cwd();
  const pkg = await readPackageJson();
  if (pkg.scripts && pkg.scripts[scriptName]) {await runLifecycleScript(pkgDir, scriptName, pkg.name);
  } else {
    console.log(`No script named '${scriptName}' in package.json.`);
  }
}

const GLOBAL_LINKS_DIR = path.join(os.homedir(), '.blaze-links');

async function blazeLink() {const pkg = await readPackageJson();
  await fs.mkdir(GLOBAL_LINKS_DIR, { recursive: true });
  const linkPath = path.join(GLOBAL_LINKS_DIR, pkg.name);
  try {
    await fs.rm(linkPath, { recursive: true, force: true });
  } catch {}
  try {
    await fs.symlink(process.cwd(), linkPath, 'dir');
    console.log(`Linked ${pkg.name} globally at ${linkPath}`);
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EEXIST') {await fs.cp(process.cwd(), linkPath, { recursive: true });
      console.log(`Copied ${pkg.name} globally at ${linkPath} (symlink not permitted)`);
    } else {
      throw err;
    }
  }
}

async function blazeUnlink() {const pkg = await readPackageJson();
  const linkPath = path.join(GLOBAL_LINKS_DIR, pkg.name);
  try {
    await fs.rm(linkPath, { recursive: true, force: true });
    console.log(`Unlinked ${pkg.name} from global links.`);
  } catch {
    console.log(`No global link found for ${pkg.name}.`);
  }
}

async function blazeLinkInstall(pkgName) {// Link a globally linked package into node_modules
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
    if (err.code === 'EPERM' || err.code === 'EEXIST') {await fs.cp(linkPath, dest, { recursive: true });
      console.log(`Copied ${pkgName} into node_modules (symlink not permitted)`);
    } else {
      throw err;
    }
  }
}

async function generateDependencyGraph() {const { resolveDependencies } = require('./resolveDependencies');
  const pkg = await readPackageJson();
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (Object.keys(deps).length === 0) {
    console.log('No dependencies to graph.');
    return;
  }
  const tree = await resolveDependencies(deps);
  let graph = 'graph TD;\n';
  const nodes = new Set();
  
  function addNode(name, version) {const safeVersion = String(version || 'local');
    const id = `${name.replace(/[@/]/g, '_')}_${safeVersion.replace(/[\^~.]/g, '_')}`;
    if (!nodes.has(id)) {
      graph += `  ${id}["${name}@${safeVersion}"];\n`;
      nodes.add(id);
    }
    return id;
  }

  for (const [name, info] of Object.entries(tree.tree)) {
    const parentId = addNode(name, info.version);
    if (info.dependencies) {for (const [depName, depInfo] of Object.entries(info.dependencies)) {
        const childId = addNode(depName, depInfo.version);
        graph += `  ${parentId} --> ${childId};\n`;
      }
    }
  }
  console.log(graph);
}

// Helper: compare dependencies in package.json and lockfile
function depsChanged(pkg, lock) {const pkgDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  const lockDeps = lock ? Object.keys(lock) : [];
  // If any dep in package.json is missing from lockfile, or version changed
  for (const dep in pkgDeps) {if (!lock || !lock[dep] || lock[dep].version !== pkgDeps[dep]) {return true;
    }
  }
  // If any dep in lockfile is missing from package.json
  for (const dep of lockDeps) {if (!pkgDeps[dep]) {return true;
    }
  }
  return false;
}

// Helper: create beautiful CLI output with box-drawing characters
function createInstallSummary(stats, options = {}) {const chalk = require('chalk');
  const version = require('../package.json').version;
  
  const {
    installed = 0,
    skipped = 0,
    duration = 0,
    packageName = '',
    packageVersion = '',
    outputPath = './node_modules/'
  } = stats;

  const {
    theme = 'dark',
    unicode = true,
    width = 40
  } = options;

  // Color schemes
  const colors = {
    dark: {
      border: 'cyan',
      success: 'green',
      warning: 'yellow',
      info: 'blue',
      text: 'white'
    },
    light: {
      border: 'gray',
      success: 'blue',
      warning: 'red',
      info: 'cyan',
      text: 'black'
    }
  };

  const colorScheme = colors[theme];
  
  // Unicode/ASCII options
  const symbols = unicode ? {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
    topTee: '┬',
    bottomTee: '┴',
    leftTee: '├',
    rightTee: '┤',
    success: '✅',
    warning: '⚠️',
    clock: '⏱',
    wrench: '🔧'
  } : {
    topLeft: '+',
    topRight: '+',
    bottomLeft: '+',
    bottomRight: '+',
    horizontal: '-',
    vertical: '|',
    topTee: '+',
    bottomTee: '+',
    leftTee: '+',
    rightTee: '+',
    success: 'OK',
    warning: '!!',
    clock: 'TIME',
    wrench: 'TOOLS'
  };

  const durationStr = `${duration.toFixed(2)}s`;
  const packageInfo = packageName ? `${packageName}@${packageVersion}` : 'Dependencies';
  
  // Calculate dynamic widths
  const labelWidth = 15;
  const valueWidth = width - labelWidth - 4; // Account for borders and padding
  
  // Helper function to pad and align text
  const alignText = (text, width, align = 'left') => {
    // Simple text width calculation - can be enhanced later
    const textWidth = text.length; // Fallback to simple length
    const padding = width - textWidth;
    
    if (align === 'right') {return ' '.repeat(Math.max(0, padding)) + text;
    } else if (align === 'center') {
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(Math.max(0, leftPad)) + text + ' '.repeat(Math.max(0, rightPad));
    } else {
      return text + ' '.repeat(Math.max(0, padding));
    }
  };

  // Create table rows with proper alignment
  const rows = [
    { label: 'Package', value: packageInfo },
    { label: 'Installed in', value: durationStr },
    { label: 'Skipped', value: skipped > 0 ? `${skipped} (cached)` : 'None' },
    { label: 'Output Path', value: outputPath }
  ];

  // Build the box content
  const content = [
    `${symbols.topLeft}${symbols.horizontal.repeat(width)}${symbols.topRight}`,
    `${symbols.vertical}${alignText(`Blaze Install v${version}`, width, 'center')}${symbols.vertical}`,
    `${symbols.leftTee}${symbols.horizontal.repeat(labelWidth)}${symbols.topTee}${symbols.horizontal.repeat(valueWidth)}${symbols.rightTee}`
  ];

  // Add data rows
  rows.forEach(row => {
    const label = alignText(row.label, labelWidth);
    const value = alignText(row.value, valueWidth);
    content.push(`${symbols.vertical}${label}${symbols.vertical}${value}${symbols.vertical}`);
  });

  // Add summary row
  content.push(`${symbols.leftTee}${symbols.horizontal.repeat(labelWidth)}${symbols.bottomTee}${symbols.horizontal.repeat(valueWidth)}${symbols.rightTee}`);
  
  const successText = chalk.green(`${symbols.success} Success:`);
  const warningText = chalk.yellow(`${symbols.warning} Skipped:`);
  const clockText = chalk.blue(symbols.clock);
  
  const summaryLine = `${symbols.vertical} ${successText} ${installed.toString().padStart(3)}    ${warningText} ${skipped.toString().padStart(2)}        ${clockText} ${durationStr}  ${symbols.vertical}`;
  content.push(summaryLine);
  
  content.push(`${symbols.bottomLeft}${symbols.horizontal.repeat(width)}${symbols.bottomRight}`);
  content.push('');
  content.push(`${symbols.wrench} Run with --debug for more details.`);

  return content.join('\n');
}

async function main(args) {try {
    const blazerc = await loadBlazerc();
    plugins = await loadPlugins();
    const config = { ...blazerc, ...readNpmrc() };
    const saveDev = args.includes('--save-dev');
    const production = args.includes('--production');
    const useSymlinks = args.includes('--symlink') || config.symlink;
    const jsonOutput = args.includes('--json');

    // Handle --interactive flag
    if (args.includes('--interactive') && process.stdout.isTTY) {
      const inquirer = require('inquirer');
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: 'Install a package', value: 'install' },
            { name: 'Uninstall a package', value: 'uninstall' },
            { name: 'Update a package', value: 'update' },
            { name: 'Interactive package upgrade', value: 'upgrade-interactive' },
            { name: 'Audit dependencies', value: 'audit' },
            { name: 'List installed packages', value: 'list' },
            { name: 'Clean node_modules and cache', value: 'clean' },
            { name: 'Show outdated dependencies', value: 'outdated' },
            { name: 'Show info about a package', value: 'info' },
            { name: 'Generate dependency graph', value: 'graph' },
            { name: 'Manage themes', value: 'theme' },
            { name: 'Exit', value: 'exit' }
          ]
        }
      ]);
      if (action === 'exit') return;
      let pkgName = '';
      if (['install', 'uninstall', 'update', 'info', 'graph'].includes(action)) {
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
      if (pkgName) {await main([action, pkgName]);
      } else {
        await main([action]);
      }
      return;
    }

    const [command, ...rest] = args;

    // Help command
    if (command === 'help' || args.includes('--help') || args.includes('-h')) {
      try {
        console.log('Blaze Install - A fast, modern alternative to npm install');
        console.log('Usage:');
        console.log('  blaze install                    # Install dependencies from package.json');
        console.log('  blaze install <package>          # Install a specific package');
        console.log('  blaze install <package>@<version> # Install specific version');
        console.log('Commands:');
        console.log('  install, i                       # Install dependencies');
        console.log('  uninstall, remove, rm            # Remove a package');
        console.log('  update, up                       # Update packages');
        console.log('  upgrade-interactive, upgrade     # Interactive package upgrade');
        console.log('  audit                            # Security audit');
        console.log('  doctor                           # Diagnose and fix issues');
        console.log('  graph                            # Generate dependency graph');
        console.log('  migrate                          # Migrate from other package managers');
        console.log('  validate                         # Validate package.json');
        console.log('  profile                          # Performance profiling');
        console.log('  registry status                  # Check registry status');
        console.log('  signing                          # Manage package signing');
        console.log('  theme                            # Manage CLI themes');
        console.log('Options:');
        console.log('  --production, -P                 # Install only production dependencies');
        console.log('  --save-dev, -D                   # Save as dev dependency');
        console.log('  --no-lockfile                    # Skip lockfile generation');
        console.log('  --offline                        # Use cached packages only');
        console.log('  --debug                          # Enable debug output');
        console.log('  --theme <theme>                  # Set theme (default, rainbow, minimal, corporate, dark, retro)');
        console.log('  --dark, --light                  # Theme selection');
        console.log('  --ascii, --no-unicode            # ASCII mode for terminals without unicode');
        console.log('Examples:');
        console.log('  blaze install lodash             # Install lodash');
        console.log('  blaze install lodash@^4.17.21    # Install specific version');
        console.log('  blaze install --production       # Install only production deps');
        console.log('  blaze upgrade-interactive        # Interactive package upgrade');
        console.log('  blaze theme list                 # List available themes');
        console.log('  blaze theme set rainbow          # Set rainbow theme');
        console.log('  blaze doctor --fix               # Auto-fix common issues');
        console.log('For more information:');
        console.log('  https://github.com/blazeinstall/Blaze');
      } catch (err) {
        console.error('Error:', err);
      }
      return;
    }

    // Prefetch command (must be before install handler)
    if (command === 'prefetch') {// Prefetch/cache all dependencies and tarballs for offline use
      const rootPkg = await readPackageJson();
      let depsToPrefetch = {};
      if (rootPkg.workspaces && Array.isArray(rootPkg.workspaces)) {
        const { allDeps, allDevDeps } = await readWorkspacePackageJsons(rootPkg.workspaces);
        depsToPrefetch = { ...(rootPkg.dependencies || {}), ...(rootPkg.devDependencies || {}), ...allDeps, ...allDevDeps };
      } else {
        depsToPrefetch = { ...(rootPkg.dependencies || {}), ...(rootPkg.devDependencies || {}) };
      }
      if (Object.keys(depsToPrefetch).length === 0) {
        console.log('No dependencies to prefetch.');
        return;
      }
      const { prefetchAll } = require('./prefetch');
      await prefetchAll(depsToPrefetch);
      return;
    }

    // Enterprise commands
    if (command === 'migrate') {console.log('🔄 Detecting lockfiles for migration...');
      const result = await migrationTools.autoMigrate();
      if (result.success) {console.log(`✅ Migration completed! Converted ${result.converted} packages.`);
      } else {
        console.log(`❌ Migration failed: ${result.reason || result.error}`);
      }
      return;
    }

    if (command === 'validate') {console.log('🔍 Validating package.json...');
      const validation = await migrationTools.validatePackageJson();
      if (validation.valid) {console.log('✅ package.json is valid!');
      } else {
        console.log('❌ package.json has issues:');
        for (const issue of validation.issues) {console.log(`  - ${issue}`);
        }
        console.log('\n💡 Suggestions:');
        for (const suggestion of validation.suggestions) {console.log(`  - ${suggestion}`);
        }
      }
      return;
    }

    if (command === 'profile') {if (rest[0] === 'start') {performanceProfiler.start();
        console.log('📊 Performance profiling started');
        return;
      }
      if (rest[0] === 'stop') {performanceProfiler.end();
        performanceProfiler.printSummary();
        const recommendations = performanceProfiler.getRecommendations();
        if (recommendations.length > 0) {console.log('\n💡 Recommendations:');
          for (const rec of recommendations) {console.log(`  - ${rec}`);
          }
        }
        return;
      }
      if (rest[0] === 'save') {const reportPath = await performanceProfiler.saveReport(rest[1]);
        console.log(`📊 Report saved to: ${reportPath}`);
        return;
      }
      console.log('Usage: blaze profile <start|stop|save> [filename]');
      return;
    }

    if (command === 'registry') {if (rest[0] === 'status') {const status = registryMirror.getRegistryStatus();
        console.log('🌐 Registry Status:');
        console.log(`  Current: ${status.current}`);
        console.log(`  Healthy: ${status.healthy.length}/${status.all.length}`);
        if (status.failed.length > 0) {console.log(`  Failed: ${status.failed.join(', ')}`);
        }
        return;
      }
      console.log('Usage: blaze registry status');
      return;
    }

    if (command === 'signing') {if (rest[0] === 'keys') {const keys = packageSigning.getTrustedKeys();
        console.log('🔑 Trusted Keys:');
        if (keys.length === 0) {console.log('  (none configured)');
        } else {
          for (const key of keys) {console.log(`  - ${key}`);
          }
        }
        return;
      }
      if (rest[0] === 'add-key' && rest[1]) {packageSigning.addTrustedKey(rest[1]);
        console.log(`✅ Added trusted key: ${rest[1]}`);
        return;
      }
      console.log('Usage: blaze signing <keys|add-key <key>>');
      return;
    }

    // Interactive upgrade command
    if (command === 'upgrade-interactive' || command === 'upgrade') {const { InteractiveUpgrade } = require('./interactiveUpgrade');
      const { ThemeManager } = require('./themeManager');
      
      const themeManager = new ThemeManager();
      const interactiveUpgrade = new InteractiveUpgrade();
      
      // Determine theme from args
      let theme = 'default';
      if (args.includes('--theme')) {
        const themeIndex = args.indexOf('--theme');
        if (args[themeIndex + 1]) {theme = args[themeIndex + 1];
        }
      }
      
      try {
        const rootPkg = await readPackageJson();
        const allDeps = { ...(rootPkg.dependencies || {}), ...(rootPkg.devDependencies || {}) };
        
        if (Object.keys(allDeps).length === 0) {
          console.log(themeManager.formatInfo('No dependencies found to upgrade.', theme));
          return;
        }
        
        const outdated = await interactiveUpgrade.getOutdatedPackages(allDeps);
        
        if (outdated.length === 0) {console.log(themeManager.formatSuccess('All packages are up to date!', theme));
          return;
        }
        
        const selectedPackages = await interactiveUpgrade.showUpgradeMenu(outdated, theme);
        
        if (selectedPackages.length === 0) {console.log(themeManager.formatInfo('No packages selected for upgrade.', theme));
          return;
        }
        
        await interactiveUpgrade.showUpgradeSummary(selectedPackages, outdated, theme);
        
        const confirmed = await interactiveUpgrade.confirmUpgrade(theme);
        if (!confirmed) {console.log(themeManager.formatInfo('Upgrade cancelled.', theme));
          return;
        }
        
        await interactiveUpgrade.showUpgradeProgress(selectedPackages, theme);
        
        // Actually perform the upgrades
        for (const pkgName of selectedPackages) {const pkg = outdated.find(p => p.name === pkgName);
          if (pkg) {await updatePackage(pkgName, false);
          }
        }
        
        console.log(themeManager.formatSuccess('Upgrade completed successfully!', theme));
        
      } catch (error) {
        console.error(themeManager.formatError(`Upgrade failed: ${error.message}`, theme));
      }
      return;
    }

    // Theme management commands
    if (command === 'theme') {const { ThemeManager } = require('./themeManager');
      const themeManager = new ThemeManager();
      
      if (rest[0] === 'list') {const themes = themeManager.listThemes();
        console.log('\n🎨 Available Themes:');
        console.log('='.repeat(50));
        
        for (const theme of themes) {const status = theme.current ? ' (current)' : '';
          console.log(`${theme.name}${status}`);
          console.log(`  ${theme.description}`);
          console.log('');
        }
        return;
      }
      
      if (rest[0] === 'set' && rest[1]) {const success = themeManager.setTheme(rest[1]);
        if (success) {console.log(`✅ Theme set to: ${rest[1]}`);
        } else {
          console.log(`❌ Theme not found: ${rest[1]}`);
          console.log('Use "blaze theme list" to see available themes.');
        }
        return;
      }
      
      if (rest[0] === 'current') {const currentTheme = themeManager.getTheme();
        console.log(`Current theme: ${currentTheme.name}`);
        console.log(`Description: ${currentTheme.description}`);
        return;
      }
      
      console.log('Usage: blaze theme <list|set <theme>|current>');
      console.log('Available themes: default, rainbow, minimal, corporate, dark, retro');
      return;
    }

    // Call onCommand plugin hook
    for (const plugin of plugins) {if (typeof plugin.onCommand === 'function') {
        await plugin.onCommand({ command, args, context: { cwd: process.cwd() } });
      }
    }
    
    if (command === 'uninstall') {if (!rest[0]) {console.log('Usage: blaze uninstall <package>');
        return;
      }
      // Plugin hook
      for (const plugin of plugins) {if (typeof plugin.beforeUninstall === 'function') {
          await plugin.beforeUninstall({ args, context: { cwd: process.cwd() } });
        }
      }
      // Run preuninstall/uninstall/postuninstall scripts
      const pkgDir = path.join(process.cwd(), 'node_modules', rest[0]);
      await runLifecycleScript(pkgDir, 'preuninstall', rest[0]);
      await runLifecycleScript(pkgDir, 'uninstall', rest[0]);
      await uninstallPackage(rest[0]);
      await runLifecycleScript(pkgDir, 'postuninstall', rest[0]);
      await pruneLockfile();
      // Add a short delay to avoid race conditions on Windows
      await new Promise(res => setTimeout(res, 100));
      // Plugin hook
      for (const plugin of plugins) {if (typeof plugin.afterUninstall === 'function') {
          await plugin.afterUninstall({ args, context: { cwd: process.cwd() } });
        }
      }
      console.log('Running install to update dependencies...');
      await main(['install']);
      return;
    }
    if (command === 'update') {// Plugin hook
      for (const plugin of plugins) {if (typeof plugin.beforeUpdate === 'function') {
          await plugin.beforeUpdate({ args, context: { cwd: process.cwd() } });
        }
      }
      if (!rest[0]) {console.log('Usage: blaze update <package>');
        return;
      }
      const pkg = await readPackageJson();
      const isDev = pkg.devDependencies && pkg.devDependencies[rest[0]];
      await updatePackage(rest[0], isDev);
      // Plugin hook
      for (const plugin of plugins) {if (typeof plugin.afterUpdate === 'function') {
          await plugin.afterUpdate({ args, context: { cwd: process.cwd() } });
        }
      }
    }
    if (command === 'list') {const pkg = await readPackageJson();
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
    if (command === 'clean') {// Plugin hook
      for (const plugin of plugins) {if (typeof plugin.beforeClean === 'function') {
          await plugin.beforeClean({ context: { cwd: process.cwd() } });
        }
      }
      let removed = false;
      async function tryRemove(target) {try {
          await fs.rm(target, { recursive: true, force: true });
          console.log(chalk.green(`Removed ${target}`));
          removed = true;
        } catch (err) {
          // Only print if not ENOENT
          if (err.code !== 'ENOENT') {console.log(chalk.red(`Failed to remove ${target}: ${err.message}`));
          }
        }
      }
      await tryRemove(path.join(process.cwd(), 'node_modules'));
      await tryRemove(path.join(process.cwd(), '.cache'));
      await tryRemove(path.join(process.cwd(), 'node_modules', '.cache'));
      if (!removed) {console.log(chalk.yellow('Nothing to clean.'));
      }
      // Plugin hook
      for (const plugin of plugins) {if (typeof plugin.afterClean === 'function') {
          await plugin.afterClean({ context: { cwd: process.cwd() } });
        }
      }
      return;
    }
    if (command === 'outdated') {const pkg = await readPackageJson();
      const deps = pkg.dependencies || {};
      const devDeps = pkg.devDependencies || {};
      const all = { ...deps, ...devDeps };
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
    if (command === 'info') {const axios = require('axios');
      if (!rest[0]) {console.log('Usage: blaze info <package>');
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
        if (info.maintainers) {const maintainers = Array.isArray(info.maintainers) ? info.maintainers.map(m => m.name).join(', ') : info.maintainers;
          console.log(chalk.green('Maintainers:'), maintainers);
        }
        console.log();
      } catch (err) {
        console.log(chalk.red('Error fetching info for'), pkgName, '-', err.message);
      }
      return;
    }
    if (command === 'publish') {// Run prepublish, prepare, prepack, postpack, postpublish scripts
      await runLifecycleScript(process.cwd(), 'prepublish', '');
      await runLifecycleScript(process.cwd(), 'prepare', '');
      await runLifecycleScript(process.cwd(), 'prepack', '');
      await publishPackage();
      await runLifecycleScript(process.cwd(), 'postpack', '');
      await runLifecycleScript(process.cwd(), 'postpublish', '');
      return;
    }
    if (command === 'version') {if (!rest[0]) {console.log('Usage: blaze version <newversion>');
        return;
      }
      // Run preversion, version, postversion scripts
      await runLifecycleScript(process.cwd(), 'preversion', '');
      await bumpVersion(rest[0]);
      await runLifecycleScript(process.cwd(), 'version', '');
      await runLifecycleScript(process.cwd(), 'postversion', '');
      return;
    }
    if (command === 'run') {if (!rest[0]) {console.log('Usage: blaze run <script>');
        return;
      }
      await runScript(rest[0]);
      return;
    }
    if (command === 'graph') {await generateDependencyGraph();
      return;
    }
    if (command === 'link') {if (rest[0]) {await blazeLinkInstall(rest[0]);
      } else {
        await blazeLink();
      }
      return;
    }
    if (command === 'unlink') {await blazeUnlink();
      return;
    }
    if (command === 'audit') {// Plugin hook
      for (const plugin of plugins) {if (typeof plugin.beforeAudit === 'function') {
          await plugin.beforeAudit({ context: { cwd: process.cwd() } });
        }
      }
      await auditPackages();
      // Plugin hook
      for (const plugin of plugins) {if (typeof plugin.afterAudit === 'function') {
          await plugin.afterAudit({ context: { cwd: process.cwd() } });
        }
      }
      return;
    }
    if (command === 'doctor') {const fix = args.includes('--fix');
      const diagnostics = require('./diagnostics');
      await diagnostics.runDoctor(fix);
      return;
    }
    console.log('Welcome to blaze-install!');
    console.log('Arguments:', args);
    if (command === 'install' || command === undefined) {const offline = args.includes('--offline');
      console.log('Entered install command logic (latest code)');
      const auditFix = args.includes('--audit-fix');
      const noLockfile = args.includes('--no-lockfile');
      const workspaceFlagIndex = args.findIndex(arg => arg === '--workspace');
      
      // CLI output options
      const theme = args.includes('--light') ? 'light' : args.includes('--dark') ? 'dark' : 'dark';
      const unicode = !args.includes('--ascii') && !args.includes('--no-unicode');
      const width = 40; // Could be made configurable with --width flag
      
      let workspaceTarget = null;
      if (workspaceFlagIndex !== -1 && args[workspaceFlagIndex + 1]) {workspaceTarget = args[workspaceFlagIndex + 1];
      }
      // Filter out CLI flags from rest (package names)
      const rest = args.filter(arg => !arg.startsWith('--') && arg !== command);
      if (auditFix && noLockfile) {console.error('Error: --audit-fix cannot be used with --no-lockfile. The audit requires a lockfile.');
        process.exit(1);
      }
      for (const plugin of plugins) {if (typeof plugin.beforeInstall === 'function') {
          await plugin.beforeInstall({ args, context: { cwd: process.cwd() } });
        }
      }
      let addingPackage = rest.length >= 1 && rest[0];
      let pkgName, range, versionOrRange;
      let targetPkgPath = path.resolve(process.cwd(), 'package.json');
      let rootPkg = await readPackageJson();
      let isMonorepo = Array.isArray(rootPkg.workspaces) && rootPkg.workspaces.length > 0;
      let workspaceChoices = [];
      if (isMonorepo) {// Find all workspace package.json files
        for (const wsGlob of rootPkg.workspaces) {const wsAbsPath = path.resolve(process.cwd(), wsGlob);
          const wsPkgPath = path.join(wsAbsPath, 'package.json');
          try {
            await fs.access(wsPkgPath);
            workspaceChoices.push({ name: wsGlob, value: wsPkgPath });
          } catch {}
        }
        // Add root as a choice
        workspaceChoices.unshift({ name: '[root]', value: path.resolve(process.cwd(), 'package.json') });
      }
      // If adding a package, determine the target package.json
      if (addingPackage && rest[0]) {({ name: pkgName, range } = parsePackageArg(rest[0]));
        versionOrRange = await resolveVersionOrRange(pkgName, range, { offline });
        // If --workspace flag is used
        if (workspaceTarget) {const found = workspaceChoices.find(w => w.name === workspaceTarget || w.value.includes(workspaceTarget));
          if (found) {targetPkgPath = found.value;
          } else {
            console.error(`Workspace '${workspaceTarget}' not found.`);
            process.exit(1);
          }
        } else if (isMonorepo) {
          // If inside a workspace, use that workspace
          const cwd = process.cwd();
          const found = workspaceChoices.find(w => cwd.startsWith(path.dirname(w.value)) && w.value !== path.resolve(process.cwd(), 'package.json'));
          if (found) {targetPkgPath = found.value;
          } else {
            // Prompt user to select target
            const inquirer = require('inquirer');
            const { chosen } = await inquirer.prompt([
              {
                type: 'list',
                name: 'chosen',
                message: 'Which workspace should this dependency be added to?',
                choices: workspaceChoices
              }
            ]);
            targetPkgPath = chosen;
          }
        }
        // Add dependency to the selected package.json
        const targetPkg = JSON.parse(await fs.readFile(targetPkgPath, 'utf-8'));
        const dev = saveDev;
        if (dev) {targetPkg.devDependencies = targetPkg.devDependencies || {};
          targetPkg.devDependencies[pkgName] = versionOrRange;
          console.log(`Added ${pkgName}@${versionOrRange} to devDependencies in ${targetPkgPath}`);
        } else {
          targetPkg.dependencies = targetPkg.dependencies || {};
          targetPkg.dependencies[pkgName] = versionOrRange;
          console.log(`Added ${pkgName}@${versionOrRange} to dependencies in ${targetPkgPath}`);
        }
        await fs.writeFile(targetPkgPath, JSON.stringify(targetPkg, null, 2), 'utf-8');
        console.log(`Dependency added to: ${targetPkgPath}`);
      }
      // Now, always re-read all workspace and root package.json files for dependency resolution
      let rootPkgLatest = await readPackageJson();
      let depsToInstall = {};
      let workspacePaths = [];
      const ciMode = args.includes('--ci');
      if (ciMode) {const tryRemove = async (target) => {
          try { await fs.rm(target, { recursive: true, force: true }); } catch {}
        };
        await tryRemove(path.join(process.cwd(), 'node_modules'));
      }
      if (rootPkgLatest.workspaces && Array.isArray(rootPkgLatest.workspaces)) {
        console.log('Detected workspaces:', rootPkgLatest.workspaces);
        
        // Use new workspace resolver for proper dependency resolution
        const workspaceResolver = new WorkspaceResolver(process.cwd());
        await workspaceResolver.discoverWorkspaces(rootPkgLatest.workspaces);
        workspaceResolver.buildDependencyGraph();
        
        const resolvedDeps = workspaceResolver.resolveDependencies(
          rootPkgLatest.dependencies || {},
          rootPkgLatest.devDependencies || {}
        );
        
        if (args.includes('--debug')) {
          console.log('Workspace resolution result:', {
            hoisted: Object.keys(resolvedDeps.hoisted).length,
            workspaceSpecific: Object.keys(resolvedDeps.workspaceSpecific).length,
            conflicts: resolvedDeps.conflicts.length
          });
        }
        
        // Use hoisted dependencies for installation
        if (production) {depsToInstall = resolvedDeps.hoisted;
        } else {
          depsToInstall = resolvedDeps.hoisted;
        }
        
        workspacePaths = workspaceResolver.getWorkspacePaths();
      } else {
        if (production) {depsToInstall = rootPkgLatest.dependencies || {};
        } else {
          depsToInstall = { ...(rootPkgLatest.dependencies || {}), ...(rootPkgLatest.devDependencies || {}) };
        }
      }
      const hasLocalDeps = Object.values(depsToInstall).some(v => typeof v === 'string' && (v.startsWith('file:') || v.startsWith('link:')));
      let lock = null;
      if (!noLockfile && !hasLocalDeps) {lock = await readLockfile();
      }
      if (addingPackage) {// Always resolve and update lockfile when adding a package
        const startTime = Date.now();
        if (Object.keys(depsToInstall).length > 0) {
          // Show platform information for cross-platform consistency
          const currentPlatform = getCurrentPlatform();
          if (args.includes('--debug')) {
            console.log(`Platform: ${currentPlatform.combined} (${currentPlatform.platform}-${currentPlatform.arch})`);
            console.log('Platform-aware dependency resolution enabled - filtering incompatible optional dependencies');
          }
          
          const tree = await resolveDependencies(depsToInstall, {}, null, [], [], { offline });
          
          // Enhanced peer dependency handling with auto-resolution
          const peerWarnings = tree.peerWarnings || [];
          const optionalWarnings = tree.optionalWarnings || [];
          const resolvedTree = tree.tree;
          
          if (peerWarnings.length > 0 && !offline) {console.log('\nPeer dependency warnings:');
            for (const w of peerWarnings) console.log('  - ' + w);
            
            // Auto-resolve peer dependencies
            const peerResolver = new PeerDependencyResolver();
            const resolvedPeers = await peerResolver.autoResolvePeers(peerWarnings, depsToInstall);
            
            if (Object.keys(resolvedPeers).length > Object.keys(depsToInstall).length) {
              console.log('Auto-resolving peer dependencies...');
              
              // Add resolved peers to dependencies and re-resolve
              const updatedDeps = { ...depsToInstall, ...resolvedPeers };
              const treeWithPeers = await resolveDependencies(updatedDeps, {}, null, [], [], { offline });
              
              const stats = await installTree(treeWithPeers.tree, process.cwd(), { useSymlinks });
              
              // Handle binary packages (Playwright, Puppeteer, etc.)
              const binaryHandler = new BinaryPackageHandler();
              const binaryStats = { handled: 0, skipped: 0, errors: 0 };
              
              for (const [pkgName, pkgInfo] of Object.entries(treeWithPeers.tree)) {
                if (binaryHandler.isBinaryPackage(pkgName)) {
                  const packageDir = path.join(process.cwd(), 'node_modules', pkgName);
                  try {
                    const result = await binaryHandler.handleBinaryPackage(packageDir, pkgName);
                    if (result.success) {binaryStats.handled++;
                      if (args.includes('--debug')) {
                        console.log(`Binary package ${pkgName} handled successfully:`, result);
                      }
                    } else {
                      binaryStats.errors++;
                      console.warn(`Warning: Binary package ${pkgName} failed: ${result.error}`);
                    }
                  } catch (err) {
                    binaryStats.errors++;
                    console.warn(`Warning: Error handling binary package ${pkgName}: ${err.message}`);
                  }
                } else {
                  binaryStats.skipped++;
                }
              }
              
              if (args.includes('--debug') && (binaryStats.handled > 0 || binaryStats.errors > 0)) {
                console.log(`Binary package handling: ${binaryStats.handled} handled, ${binaryStats.skipped} skipped, ${binaryStats.errors} errors`);
              }
              
              if (!noLockfile) {await writeLockfile(treeWithPeers.tree);
              }
              
              const duration = (Date.now() - startTime) / 1000;
            }
          }
          
          if (args.includes('--debug')) {
            console.log('Full resolved dependency tree:', resolvedTree);
          }
          const stats = await installTree(resolvedTree, process.cwd(), { useSymlinks });
          
          // Handle binary packages (Playwright, Puppeteer, etc.)
          const binaryHandler = new BinaryPackageHandler();
          const binaryStats = { handled: 0, skipped: 0, errors: 0 };
          
          for (const [pkgName, pkgInfo] of Object.entries(resolvedTree)) {
            if (binaryHandler.isBinaryPackage(pkgName)) {
              const packageDir = path.join(process.cwd(), 'node_modules', pkgName);
              try {
                const result = await binaryHandler.handleBinaryPackage(packageDir, pkgName);
                if (result.success) {binaryStats.handled++;
                  if (args.includes('--debug')) {
                    console.log(`Binary package ${pkgName} handled successfully:`, result);
                  }
                } else {
                  binaryStats.errors++;
                  console.warn(`Warning: Binary package ${pkgName} failed: ${result.error}`);
                }
              } catch (err) {
                binaryStats.errors++;
                console.warn(`Warning: Error handling binary package ${pkgName}: ${err.message}`);
              }
            } else {
              binaryStats.skipped++;
            }
          }
          
          if (args.includes('--debug') && (binaryStats.handled > 0 || binaryStats.errors > 0)) {
            console.log(`Binary package handling: ${binaryStats.handled} handled, ${binaryStats.skipped} skipped, ${binaryStats.errors} errors`);
          }
          
          if (!noLockfile) {await writeLockfile(resolvedTree);
          }
        } else {
          console.log('No dependencies found in package.json.');
        }
      } else if (lock && !noLockfile) {
        // Check if package.json and lockfile are out of sync
        if (depsChanged(rootPkgLatest, lock)) {
          const startTime = Date.now();
          if (Object.keys(depsToInstall).length > 0) {
            // Show platform information for cross-platform consistency
            const currentPlatform = getCurrentPlatform();
            if (args.includes('--debug')) {
              console.log(`Platform: ${currentPlatform.combined} (${currentPlatform.platform}-${currentPlatform.arch})`);
              console.log('Platform-aware dependency resolution enabled - filtering incompatible optional dependencies');
            }
            
            const tree = await resolveDependencies(depsToInstall, {}, null, [], [], { offline });
            const stats = await installTree(tree.tree, process.cwd(), { useSymlinks });
            
            // Handle binary packages (Playwright, Puppeteer, etc.)
            const binaryHandler = new BinaryPackageHandler();
            const binaryStats = { handled: 0, skipped: 0, errors: 0 };
            
            for (const [pkgName, pkgInfo] of Object.entries(tree.tree)) {
              if (binaryHandler.isBinaryPackage(pkgName)) {
                const packageDir = path.join(process.cwd(), 'node_modules', pkgName);
                try {
                  const result = await binaryHandler.handleBinaryPackage(packageDir, pkgName);
                  if (result.success) {binaryStats.handled++;
                    if (args.includes('--debug')) {
                      console.log(`Binary package ${pkgName} handled successfully:`, result);
                    }
                  } else {
                    binaryStats.errors++;
                    console.warn(`Warning: Binary package ${pkgName} failed: ${result.error}`);
                  }
                } catch (err) {
                  binaryStats.errors++;
                  console.warn(`Warning: Error handling binary package ${pkgName}: ${err.message}`);
                }
              } else {
                binaryStats.skipped++;
              }
            }
            
            if (!noLockfile) {
              await writeLockfile(tree.tree);
            }
            
            const duration = (Date.now() - startTime) / 1000;
            try {
              const summary = await createInstallSummary({
              installed: stats.installed,
              skipped: stats.skipped,
                duration
              }, { theme, unicode, width });
              console.log(summary);
            } catch (error) {
              console.error('Error generating install summary:', error);
            }
          } else {
            console.log('No dependencies found in package.json.');
          }
        } else {
          if (Object.keys(lock).length === 0) {
            console.log('No dependencies to install. Skipping install.');
            return;
          }
          const startTime = Date.now();
          const stats = await installTree(lock, process.cwd(), { useSymlinks });
          
          // Handle binary packages (Playwright, Puppeteer, etc.)
          const binaryHandler = new BinaryPackageHandler();
          const binaryStats = { handled: 0, skipped: 0, errors: 0 };
          
          for (const [pkgName, pkgInfo] of Object.entries(lock)) {
            if (binaryHandler.isBinaryPackage(pkgName)) {
              const packageDir = path.join(process.cwd(), 'node_modules', pkgName);
              try {
                const result = await binaryHandler.handleBinaryPackage(packageDir, pkgName);
                if (result.success) {binaryStats.handled++;
                  if (args.includes('--debug')) {
                    console.log(`[DEBUG] Binary package ${pkgName} handled successfully:`, result);
                  }
                } else {
                  binaryStats.errors++;
                  console.warn(`[WARNING] Binary package ${pkgName} failed: ${result.error}`);
                }
              } catch (err) {
                binaryStats.errors++;
                console.warn(`Warning: Error handling binary package ${pkgName}: ${err.message}`);
              }
            } else {
              binaryStats.skipped++;
            }
          }
          
          const duration = (Date.now() - startTime) / 1000;
          try {
            const summary = await createInstallSummary({
            installed: stats.installed,
            skipped: stats.skipped,
            duration
            }, { theme, unicode, width });
            console.log(summary);
          } catch (error) {
            console.error('Error generating install summary:', error);
          }
        }
      } else {
        // No lockfile or lockfile skipped, resolve and install
        const startTime = Date.now();
        if (Object.keys(depsToInstall).length > 0) {
          // Show platform information for cross-platform consistency
          const currentPlatform = getCurrentPlatform();
          if (args.includes('--debug')) {
            console.log(`[DEBUG] Platform: ${currentPlatform.combined} (${currentPlatform.platform}-${currentPlatform.arch})`);
            console.log('[DEBUG] Platform-aware dependency resolution enabled - filtering incompatible optional dependencies');
          }
          
          const tree = await resolveDependencies(depsToInstall, {}, null, [], [], { offline });
          if (args.includes('--debug')) {
            console.log('Resolved dependency tree:', tree.tree);
          }
          const stats = await installTree(tree.tree, process.cwd(), { useSymlinks });
          
          // Handle binary packages (Playwright, Puppeteer, etc.)
          const binaryHandler = new BinaryPackageHandler();
          const binaryStats = { handled: 0, skipped: 0, errors: 0 };
          
          for (const [pkgName, pkgInfo] of Object.entries(tree.tree)) {
            if (binaryHandler.isBinaryPackage(pkgName)) {
              const packageDir = path.join(process.cwd(), 'node_modules', pkgName);
              try {
                const result = await binaryHandler.handleBinaryPackage(packageDir, pkgName);
                if (result.success) {binaryStats.handled++;
                  if (args.includes('--debug')) {
                    console.log(`[DEBUG] Binary package ${pkgName} handled successfully:`, result);
                  }
                } else {
                  binaryStats.errors++;
                  console.warn(`[WARNING] Binary package ${pkgName} failed: ${result.error}`);
                }
              } catch (err) {
                binaryStats.errors++;
                console.warn(`Warning: Error handling binary package ${pkgName}: ${err.message}`);
              }
            } else {
              binaryStats.skipped++;
            }
          }
          
          if (!noLockfile) {
            await writeLockfile(tree.tree);
          }
        }
      }
      for (const plugin of plugins) {if (typeof plugin.afterInstall === 'function') {
          await plugin.afterInstall({ args, context: { cwd: process.cwd() } });
        }
      }
      console.log('DEBUG: auditFix:', auditFix, 'noLockfile:', noLockfile);
      if (auditFix && noLockfile) {console.error('Error: --audit-fix cannot be used with --no-lockfile. The audit requires a lockfile.');
        process.exit(1);
      }
      if (offline) {console.log('Offline mode enabled: will only use local cache.');
      }
      console.log('All packages installed from lockfile!');
    }
  } catch (err) {
    console.error(chalk.red('Error:'), err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

module.exports = { main, printHelp, createInstallSummary }; 