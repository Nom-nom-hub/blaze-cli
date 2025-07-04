const { readPackageJson } = require("./readPackageJson");
const { readLockfile } = require("./readLockfile");
const { resolveDependencies } = require("./resolveDependencies");
const { installTree, runLifecycleScript } = require("./installTree");
const { writeLockfile } = require("./writeLockfile");
const fs = require("fs/promises");
const path = require("path");
const axios = require("axios");
const semver = require("semver");
const glob = require("glob");
const { spawn } = require("child_process");
const os = require("os");
const { version } = require('../package.json');
const chalk = require('chalk');
let boxen = require('boxen');
if (boxen && boxen.default) boxen = boxen.default;
const Spinner = require('./lib/spinner');

let plugins = [];

function parsePackageArg(arg) {
  // e.g. lodash@4.17.21 or lodash@^4.17.0 or lodash@next
  const match = arg.match(/^(@?[^@]+)(?:@(.+))?$/);
  if (!match) return { name: arg, range: undefined };
  return { name: match[1], range: match[2] };
}

function isGithubOrTarballSpec(pkgName) {
  // github:user/repo, user/repo, user/repo#branch, tarball URLs
  return (
    /^github:[^/]+\/[^#]+(#.+)?$/.test(pkgName) ||
    /^[^/]+\/[^#]+(#.+)?$/.test(pkgName) ||
    /^https?:\/\/.+\.(tgz|tar\.gz)$/.test(pkgName)
  );
}

async function resolveVersionOrRange(
  pkgName,
  rangeOrTag,
  { offline = false } = {},
) {
  if (isGithubOrTarballSpec(pkgName)) {
    // Return as-is for special handling in installTree
    return pkgName;
  }
  if (offline) {
    // Try to resolve from local package.json or lockfile
    let pkg, lock;
    try {
      pkg = JSON.parse(await fs.readFile("package.json", "utf-8"));
    } catch {}
    try {
      lock = JSON.parse(await fs.readFile("blaze-lock.json", "utf-8"));
    } catch {}
    // Prefer lockfile
    if (lock && lock[pkgName]) {
      return `^${lock[pkgName].version || lock[pkgName]}`;
    }
    if (pkg && pkg.dependencies && pkg.dependencies[pkgName]) {
      return pkg.dependencies[pkgName];
    }
    if (pkg && pkg.devDependencies && pkg.devDependencies[pkgName]) {
      return pkg.devDependencies[pkgName];
    }
    throw new Error(
      `Offline mode: Cannot resolve version for ${pkgName}. Not found in local package.json or lockfile.`,
    );
  }
  const url = `https://registry.npmjs.org/${encodeURIComponent(pkgName)}`;
  const { data } = await axios.get(url);
  if (!rangeOrTag || rangeOrTag === "latest") {
    return `^${data["dist-tags"].latest}`;
  }
  // If it's a known tag
  if (data["dist-tags"][rangeOrTag]) {
    return `^${data["dist-tags"][rangeOrTag]}`;
  }
  // If it's a semver range, resolve to the max satisfying version
  const versions = Object.keys(data.versions);
  const max = semver.maxSatisfying(versions, rangeOrTag);
  if (max) {
    return rangeOrTag; // keep the range in package.json
  }
  // If it's not a valid semver or tag, show error
  console.error(
    `Unknown tag or invalid version/range: '${rangeOrTag}' for package '${pkgName}'.`,
  );
  process.exit(1);
}

async function addDependencyToPackageJson(pkgName, versionOrRange, dev) {
  const pkgPath = path.resolve(process.cwd(), "package.json");
  const pkg = await readPackageJson();
  if (dev) {
    pkg.devDependencies = pkg.devDependencies || {};
    pkg.devDependencies[pkgName] = versionOrRange;
    console.log(
      `Added ${pkgName}@${versionOrRange} to devDependencies in package.json.`,
    );
  } else {
    pkg.dependencies = pkg.dependencies || {};
    pkg.dependencies[pkgName] = versionOrRange;
    console.log(
      `Added ${pkgName}@${versionOrRange} to dependencies in package.json.`,
    );
  }
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2), "utf-8");
}

async function readWorkspacePackageJsons(workspaces) {
  const allDeps = {};
  const allDevDeps = {};
  const workspacePaths = [];
  for (const pattern of workspaces) {
    const matches = glob.sync(pattern, { cwd: process.cwd(), absolute: true });
    for (const wsPath of matches) {
      const pkgPath = path.join(wsPath, "package.json");
      try {
        const data = await fs.readFile(pkgPath, "utf-8");
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
  return data["dist-tags"].latest;
}

async function uninstallPackage(pkgName) {
  const pkgPath = path.resolve(process.cwd(), "package.json");
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
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2), "utf-8");
  // Remove from node_modules
  const modPath = path.join(process.cwd(), "node_modules", pkgName);
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
  // Plugin hook
  for (const plugin of plugins) {
    if (typeof plugin.beforeAudit === "function") {
      await plugin.beforeAudit({ context: { cwd: process.cwd() } });
    }
  }
  const lock = await readLockfile();
  if (!lock) {
    console.log(boxen(chalk.bold.cyan('Usage: blaze <command> [options]'), { padding: 1, borderColor: 'cyan', borderStyle: 'round' }));
    console.log(chalk.cyan('ℹ️'), chalk.gray('No blaze-lock.json found. Run blaze install first.'));
    return;
  }
  // Build dependencies object in npm audit format
  const dependencies = {};
  for (const [name, info] of Object.entries(lock)) {
    dependencies[name] = { version: info.version };
  }
  const payload = {
    name: "blaze-install",
    version: "0.0.0",
    dependencies,
  };
  const spinner = new Spinner("Running security audit");
  spinner.start();
  try {
    const { data } = await axios.post(
      "https://registry.npmjs.org/-/npm/v1/security/audits",
      payload,
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    if (
      data.metadata &&
      data.metadata.vulnerabilities &&
      data.metadata.vulnerabilities.total === 0
    ) {
      spinner.stop(chalk.green('No known vulnerabilities found!'));
      await new Promise((r) => setTimeout(r, 10));
      return;
    }
    if (data.advisories) {
      let found = 0;
      for (const key in data.advisories) {
        const advisory = data.advisories[key];
        found++;
        console.log(
          chalk.red.bold(
            `\nVULNERABILITY: ${advisory.module_name}@${advisory.findings[0].version}`,
          ),
        );
        console.log(chalk.red(`  Severity: ${advisory.severity}`));
        console.log(chalk.yellow(`  Title: ${advisory.title}`));
        console.log(chalk.gray(`  URL: ${advisory.url}`));
        console.log(
          chalk.gray(`  Vulnerable: ${advisory.vulnerable_versions}`),
        );
        console.log();
      }
      spinner.stop(chalk.red.bold(`Found ${found} vulnerable packages!`), false);
      await new Promise((r) => setTimeout(r, 10));
    } else {
      spinner.stop(chalk.green('Found 0 vulnerable packages!'));
      await new Promise((r) => setTimeout(r, 10));
    }
  } catch (err) {
    spinner.stop(`Could not audit: ${err.message}`, false);
  }
  // Plugin hook
}

async function pruneLockfile() {
  const { readLockfile } = require("./readLockfile");
  const { writeLockfile } = require("./writeLockfile");
  const { resolveDependencies } = require("./resolveDependencies");
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
  console.log(chalk.bold.cyan("\n🚀 blaze-install: A fast, modern alternative to npm install\n"));

  console.log(chalk.bold.white("Usage:"));
  console.log(chalk.gray("  blaze <command> [options]\n"));

  console.log(chalk.bold.white("Commands:"));
  console.log(chalk.green("  install [package]") + "      Install all or a specific package");
  console.log(chalk.green("  uninstall <package>") + "    Remove a package and prune lockfile");
  console.log(chalk.green("  update <package>") + "       Update a package to the latest version");
  console.log(chalk.green("  run <script>") + "           Run a script defined in package.json");
  console.log(chalk.green("  audit") + "                  Run a security audit");
  console.log(chalk.green("  list") + "                   List installed packages");
  console.log(chalk.green("  clean") + "                  Remove node_modules and cache");
  console.log(chalk.green("  outdated") + "               Show outdated dependencies");
  console.log(chalk.green("  info <package>") + "         Show info about a package");
  console.log(chalk.green("  graph") + "                  Generate a dependency graph");
  console.log(chalk.green("  help, --help") + "           Show this help message");
  console.log(chalk.green("  prefetch") + "               Prefetch/cache all dependencies for offline use");
  console.log(chalk.green("  fix") + "                    Run all available auto-fixers (lint, deps, doctor, audit)\n");

  console.log(chalk.bold.white("Options:"));
  console.log(chalk.yellow("  --save-dev") + "             Add to devDependencies");
  console.log(chalk.yellow("  --production") + "           Only install production dependencies");
  console.log(chalk.yellow("  --symlink") + "              Use symlinks instead of copying");
  console.log(chalk.yellow("  --audit-fix") + "            Run a security audit and fix after install");
  console.log(chalk.yellow("  --no-lockfile") + "          Do not use or write blaze-lock.json (lockfile-less mode)");
  console.log(chalk.yellow("  --ci") + "                   Remove node_modules before install (like npm ci)");
  console.log(chalk.yellow("  --offline") + "              Use only local cache for installs");
  console.log(chalk.yellow("  --doctor") + "               Diagnose and fix common project issues\n");

  console.log(chalk.bold.white("Examples:"));
  console.log(chalk.gray("  blaze install"));
  console.log(chalk.gray("  blaze install lodash"));
  console.log(chalk.gray("  blaze install --audit-fix"));
  console.log(chalk.gray("  blaze install --no-lockfile"));
  console.log(chalk.gray("  blaze install --ci"));
  console.log(chalk.gray("  blaze uninstall lodash"));
  console.log(chalk.gray("  blaze update lodash"));
  console.log(chalk.gray("  blaze run build"));
  console.log(chalk.gray("  blaze run test"));
  console.log(chalk.gray("  blaze audit"));
  console.log(chalk.gray("  blaze list"));
  console.log(chalk.gray("  blaze clean"));
  console.log(chalk.gray("  blaze outdated"));
  console.log(chalk.gray("  blaze info lodash"));
  console.log(chalk.gray("  blaze graph"));
  console.log(chalk.gray("  blaze install [pkg] [--offline]"));
  console.log(chalk.gray("  blaze doctor"));
  console.log(chalk.gray("  blaze prefetch\n"));
}

async function loadBlazerc() {
  try {
    const configPath = path.join(process.cwd(), ".blazerc");
    const data = await fs.readFile(configPath, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// Plugin loader
async function loadPlugins() {
  const path = require('path');
  const glob = require('glob');
  const fs = require('fs');
  // Look for plugins in both the CLI root and the current project
  const roots = [
    path.join(__dirname, '../plugins'), // CLI root
    path.join(process.cwd(), 'plugins'), // Project root
  ];
  let plugins = [];
  for (const pluginsDir of roots) {
    try {
      if (fs.existsSync(pluginsDir)) {
        const files = glob.sync('*.js', { cwd: pluginsDir, absolute: true });
        for (const file of files) {
          try {
            const plugin = require(file);
            plugins.push(plugin);
          } catch (err) {
            console.warn(`Failed to load plugin ${file}: ${err.message}`);
          }
        }
      }
    } catch {}
  }
  return plugins;
}

function readNpmrc() {
  const paths = [
    path.join(os.homedir(), ".npmrc"),
    path.join(process.cwd(), ".npmrc"),
  ];
  let config = {};
  for (const p of paths) {
    try {
      const data = require("fs").readFileSync(p, "utf-8");
      // Object.assign(config, ini.parse(data)); // ini is not defined, comment out
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
  return npmrc.registry || "https://registry.npmjs.org/";
}

function getAuthForRegistry(registry, npmrc) {
  // Normalize registry URL for token lookup
  let reg = registry.replace(/^https?:/, "").replace(/\/$/, "");
  let token = npmrc[`//${reg}/:_authToken`] || npmrc[`//${reg}:_authToken`];
  if (!token && process.env.NPM_TOKEN) token = process.env.NPM_TOKEN;
  return token;
}

function getAxiosOptions(npmrc, registry) {
  const opts = {};
  if (npmrc.proxy) opts.proxy = npmrc.proxy;
  if (npmrc["strict-ssl"] === false || npmrc["strict-ssl"] === "false")
    opts.httpsAgent = new (require("https").Agent)({
      rejectUnauthorized: false,
    });
  if (npmrc.ca) opts.ca = npmrc.ca;
  return opts;
}

async function publishPackage() {
  const config = readNpmrc();
  const pkg = await readPackageJson();
  const tar = require("tar");
  const axios = require("axios");
  const registry = getRegistryForPackage(pkg.name, config);
  const token = getAuthForRegistry(registry, config);
  const tarball = `${pkg.name}-${pkg.version}.tgz`;
  // Pack the package
  await tar.c({ gzip: true, file: tarball, cwd: process.cwd() }, ["."]);
  // Read tarball
  const data = require("fs").readFileSync(tarball);
  // Publish
  const url = `${registry.replace(/\/$/, "")}/${encodeURIComponent(pkg.name)}`;
  try {
    await axios.put(url, data, {
      headers: {
        "Content-Type": "application/octet-stream",
        Authorization: token ? `Bearer ${token}` : undefined,
      },
    });
    console.log("Published to", url);
  } catch (err) {
    console.error(
      "Publish failed:",
      err.response ? err.response.data : err.message,
    );
  }
  require("fs").unlinkSync(tarball);
}

async function bumpVersion(newVersion) {
  const pkgPath = path.join(process.cwd(), "package.json");
  const pkg = JSON.parse(require("fs").readFileSync(pkgPath, "utf-8"));
  pkg.version = newVersion;
  require("fs").writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf-8");
  const { execSync } = require("child_process");
  execSync(`git add package.json`);
  execSync(`git commit -m "chore: bump version to ${newVersion}"`);
  execSync(`git tag v${newVersion}`);
  console.log(`Version bumped to ${newVersion} and git tag created.`);
}

async function auditAndFix() {
  const lock = await readLockfile();
  if (!lock) {
    console.log(boxen(chalk.bold.cyan('Usage: blaze <command> [options]'), { padding: 1, borderColor: 'cyan', borderStyle: 'round' }));
    console.log(chalk.cyan('ℹ️'), chalk.gray('No blaze-lock.json found. Run blaze install first.'));
    return;
  }
  const dependencies = {};
  for (const [name, info] of Object.entries(lock)) {
    dependencies[name] = { version: info.version };
  }
  const payload = {
    name: "blaze-install",
    version: "0.0.0",
    dependencies,
  };
  try {
    const { data } = await require("axios").post(
      "https://registry.npmjs.org/-/npm/v1/security/audits",
      payload,
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    if (data.advisories && Object.keys(data.advisories).length > 0) {
      let updated = false;
      const pkg = await readPackageJson();
      for (const key in data.advisories) {
        const advisory = data.advisories[key];
        const dep = advisory.module_name;
        const latest = advisory.patched_versions
          .replace(/[<>=^~| ]/g, "")
          .split(",")
          .pop();
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
        require("fs").writeFileSync(
          "package.json",
          JSON.stringify(pkg, null, 2),
          "utf-8",
        );
        console.log("Reinstalling dependencies...");
        require("child_process").execSync("npm install", { stdio: "inherit" });
        console.log("Dependencies updated and reinstalled.");
      } else {
        console.log("No updatable vulnerable dependencies found.");
      }
    } else {
      console.log("No vulnerable dependencies found.");
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

const GLOBAL_LINKS_DIR = path.join(os.homedir(), ".blaze-links");

async function blazeLink() {
  const pkg = await readPackageJson();
  await fs.mkdir(GLOBAL_LINKS_DIR, { recursive: true });
  const linkPath = path.join(GLOBAL_LINKS_DIR, pkg.name);
  try {
    await fs.rm(linkPath, { recursive: true, force: true });
  } catch {}
  try {
    await fs.symlink(process.cwd(), linkPath, "dir");
    console.log(`Linked ${pkg.name} globally at ${linkPath}`);
  } catch (err) {
    if (err.code === "EPERM" || err.code === "EEXIST") {
      await fs.cp(process.cwd(), linkPath, { recursive: true });
      console.log(
        `Copied ${pkg.name} globally at ${linkPath} (symlink not permitted)`,
      );
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
  await fs.mkdir("node_modules", { recursive: true });
  const linkPath = path.join(GLOBAL_LINKS_DIR, pkgName);
  const dest = path.join(process.cwd(), "node_modules", pkgName);
  try {
    await fs.rm(dest, { recursive: true, force: true });
  } catch {}
  try {
    await fs.symlink(linkPath, dest, "dir");
    console.log(`Linked ${pkgName} into node_modules.`);
  } catch (err) {
    if (err.code === "EPERM" || err.code === "EEXIST") {
      await fs.cp(linkPath, dest, { recursive: true });
      console.log(
        `Copied ${pkgName} into node_modules (symlink not permitted)`,
      );
    } else {
      throw err;
    }
  }
}

async function generateDependencyGraph() {
  const { resolveDependencies } = require("./resolveDependencies");
  const pkg = await readPackageJson();
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (Object.keys(deps).length === 0) {
    console.log("No dependencies to graph.");
    return;
  }
  const tree = await resolveDependencies(deps);
  let graph = "graph TD;\n";
  const nodes = new Set();

  function addNode(name, version) {
    const safeVersion = String(version || "local");
    const id = `${name.replace(/[@/]/g, "_")}_${safeVersion.replace(/[\^~.]/g, "_")}`;
    if (!nodes.has(id)) {
      graph += `  ${id}["${name}@${safeVersion}"];\n`;
      nodes.add(id);
    }
    return id;
  }

  for (const [name, info] of Object.entries(tree)) {
    const parentId = addNode(name, info.version);
    if (info.dependencies) {
      for (const [depName, depInfo] of Object.entries(info.dependencies)) {
        const childId = addNode(depName, depInfo.version);
        graph += `  ${parentId} --> ${childId};\n`;
      }
    }
  }
  console.log(graph);
}

async function cleanGithubSpecs() {
  const glob = require('glob');
  const fs = require('fs/promises');
  const path = require('path');
  const pkgs = glob.sync('**/package.json', { ignore: 'node_modules/**' });
  let cleaned = 0;
  for (const pkgPath of pkgs) {
    const absPath = path.resolve(pkgPath);
    let changed = false;
    let pkg;
    try {
      pkg = JSON.parse(await fs.readFile(absPath, 'utf-8'));
    } catch { continue; }
    for (const depType of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      if (!pkg[depType]) continue;
      for (const dep of Object.keys(pkg[depType])) {
        if (/^(github:|[\w-]+\/[\w-]+(#.+)?$|https?:\/\/)/.test(dep)) {
          delete pkg[depType][dep];
          changed = true;
        }
      }
      if (Object.keys(pkg[depType]).length === 0) delete pkg[depType];
    }
    if (changed) {
      await fs.writeFile(absPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      console.log(chalk.yellow(`Cleaned non-npm specs from ${pkgPath}`));
      cleaned++;
    }
  }
  if (cleaned === 0) {
    console.log(chalk.green('No non-npm specs found in any package.json.'));
  } else {
    console.log(chalk.green(`Cleaned ${cleaned} package.json file(s).`));
  }
}

async function main(args) {
  // Welcome banner
  console.log(boxen(
    `${chalk.bold.cyan('🚀 blaze-install')} ${chalk.gray(`v${version}`)}`,
    { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'cyan', align: 'center' }
  ));

  // Arguments (only if debug mode is on)
  if (args.includes('--debug')) {
    console.log(chalk.gray('Arguments:'), chalk.magenta(JSON.stringify(args)));
  }

  // Lockfile status (more subtle)
  const lockfileExists = await fs.access('blaze-lock.json').then(() => true, () => false);
  if (lockfileExists) {
    console.log(chalk.green('🔒 Using blaze-lock.json for installation.'));
  } else {
    console.log(chalk.yellow('⚠️ No blaze-lock.json found. A new one will be generated after install.'));
  }
  console.log(); // Add a newline for spacing
  try {
    const blazerc = await loadBlazerc();
    plugins = await loadPlugins();
    const config = { ...blazerc, ...readNpmrc() };
    const saveDev = args.includes("--save-dev");
    const production = args.includes("--production");
    const useSymlinks = args.includes("--symlink") || config.symlink;
    const jsonOutput = args.includes("--json");

    // Handle --interactive flag
    if (args.includes("--interactive") && process.stdout.isTTY) {
      const inquirer = (await import("inquirer")).default;
      const { action } = await inquirer.prompt([
        {
          type: "list",
          name: "action",
          message: "What would you like to do?",
          choices: [
            { name: "Install a package", value: "install" },
            { name: "Uninstall a package", value: "uninstall" },
            { name: "Update a package", value: "update" },
            { name: "Audit dependencies", value: "audit" },
            { name: "List installed packages", value: "list" },
            { name: "Clean node_modules and cache", value: "clean" },
            { name: "Show outdated dependencies", value: "outdated" },
            { name: "Show info about a package", value: "info" },
            { name: "Generate dependency graph", value: "graph" },
            { name: "Exit", value: "exit" },
          ],
        },
      ]);
      if (action === "exit") return;
      let pkgName = "";
      if (
        ["install", "uninstall", "update", "info", "graph"].includes(action)
      ) {
        const answer = await inquirer.prompt([
          {
            type: "input",
            name: "pkg",
            message: `Package name:`,
            when: () => action !== "install" || true,
          },
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

    // Add this after argument parsing, before command dispatch
    if (args.includes('--version') || args.includes('-v')) {
      console.log(`blaze-install version ${version}`);
      process.exit(0);
    }

    const [command, ...rest] = args;

    // Help command
    if (command === "help" || command === "--help" || !command) {
      printHelp();
      return;
    }

    // Prefetch command (must be before install handler)
    if (command === "prefetch") {
      // Prefetch/cache all dependencies and tarballs for offline use
      const rootPkg = await readPackageJson();
      let depsToPrefetch = {};
      if (rootPkg.workspaces && Array.isArray(rootPkg.workspaces)) {
        const { allDeps, allDevDeps } = await readWorkspacePackageJsons(
          rootPkg.workspaces,
        );
        depsToPrefetch = {
          ...(rootPkg.dependencies || {}),
          ...(rootPkg.devDependencies || {}),
          ...allDeps,
          ...allDevDeps,
        };
      } else {
        depsToPrefetch = {
          ...(rootPkg.dependencies || {}),
          ...(rootPkg.devDependencies || {}),
        };
      }
      if (Object.keys(depsToPrefetch).length === 0) {
        console.log("No dependencies to prefetch.");
        return;
      }
      const { prefetchAll } = require("./prefetch");
      await prefetchAll(depsToPrefetch);
      return;
    }

    // Call onCommand plugin hook
    for (const plugin of plugins) {
      if (typeof plugin.onCommand === "function") {
        await plugin.onCommand({
          command,
          args,
          context: { cwd: process.cwd() },
        });
      }
    }

    // --- blaze fix command ---
    if (command === "fix") {
      console.log("Running all available auto-fixers (lint, deps, doctor, audit)...");
      // Lint/Prettier fix
      try {
        require("./plugins/eslintPrettierRunner.js").runLintersFix();
      } catch (e) {
        console.warn("[fix] Lint/Prettier auto-fix failed:", e.message);
      }
      // Remove unused dependencies
      try {
        require("./plugins/unusedDependencyLinter.js").removeUnusedDeps();
      } catch (e) {
        console.warn("[fix] Unused dependency removal failed:", e.message);
      }
      // Update outdated dependencies
      try {
        await require("./plugins/outdatedDependencyNotifier.js").updateOutdatedDeps();
      } catch (e) {
        console.warn("[fix] Outdated dependency update failed:", e.message);
      }
      // Run doctor with fix
      try {
        await require("./diagnostics").runDoctor(true);
      } catch (e) {
        console.warn("[fix] Doctor auto-fix failed:", e.message);
      }
      // Run auditAndFix if available
      try {
        if (typeof auditAndFix === "function") {
          await auditAndFix();
        }
      } catch (e) {
        console.warn("[fix] Audit auto-fix failed:", e.message);
      }
      console.log("All auto-fixers complete. Please review the output above for any manual steps.");
      return;
    }

    if (command === "uninstall") {
      if (!rest[0]) {
        console.log("Usage: blaze uninstall <package>");
        return;
      }
      // Plugin hook
      for (const plugin of plugins) {
        if (typeof plugin.beforeUninstall === "function") {
          await plugin.beforeUninstall({
            args,
            context: { cwd: process.cwd() },
          });
        }
      }
      // Run preuninstall/uninstall/postuninstall scripts
      const pkgDir = path.join(process.cwd(), "node_modules", rest[0]);
      await runLifecycleScript(pkgDir, "preuninstall", rest[0]);
      await runLifecycleScript(pkgDir, "uninstall", rest[0]);
      await uninstallPackage(rest[0]);
      await runLifecycleScript(pkgDir, "postuninstall", rest[0]);
      await pruneLockfile();
      // Add a short delay to avoid race conditions on Windows
      await new Promise((res) => setTimeout(res, 100));
      // Plugin hook
      for (const plugin of plugins) {
        if (typeof plugin.afterUninstall === "function") {
          await plugin.afterUninstall({
            args,
            context: { cwd: process.cwd() },
          });
        }
      }
      console.log("Running install to update dependencies...");
      await main(["install"]);
      return;
    }
    if (command === "update") {
      // Plugin hook
      for (const plugin of plugins) {
        if (typeof plugin.beforeUpdate === "function") {
          await plugin.beforeUpdate({ args, context: { cwd: process.cwd() } });
        }
      }
      if (!rest[0]) {
        console.log("Usage: blaze update <package>");
        return;
      }
      const pkg = await readPackageJson();
      const isDev = pkg.devDependencies && pkg.devDependencies[rest[0]];
      await updatePackage(rest[0], isDev);
      // Plugin hook
      for (const plugin of plugins) {
        if (typeof plugin.afterUpdate === "function") {
          await plugin.afterUpdate({ args, context: { cwd: process.cwd() } });
        }
      }
    }
    if (command === "list") {
      const pkg = await readPackageJson();
      const deps = pkg.dependencies || {};
      const devDeps = pkg.devDependencies || {};
      const fs = require("fs");
      const path = require("path");
      function isInstalled(name) {
        try {
          return fs.existsSync(path.join(process.cwd(), "node_modules", name));
        } catch {
          return false;
        }
      }
      console.log(
        chalk.yellow(
          "(Note: This list is based on package.json and checks node_modules for actual installs.)",
        ),
      );
      console.log(chalk.bold("\nInstalled dependencies:"));
      if (Object.keys(deps).length === 0) {
        console.log(chalk.gray("  (none)"));
      } else {
        for (const [name, version] of Object.entries(deps)) {
          if (isInstalled(name)) {
            console.log(
              chalk.green(`  ${name}@${version} (installed)`),
            );
          } else {
            console.log(
              chalk.red(
                `  ${name}@${version} (missing in node_modules)`,
              ),
            );
          }
        }
      }
      console.log(chalk.bold("\nInstalled devDependencies:"));
      if (Object.keys(devDeps).length === 0) {
        console.log(chalk.gray("  (none)"));
      } else {
        for (const [name, version] of Object.entries(devDeps)) {
          if (isInstalled(name)) {
            console.log(
              chalk.cyan(`  ${name}@${version} (installed)`),
            );
          } else {
            console.log(
              chalk.red(
                `  ${name}@${version} (missing in node_modules)`,
              ),
            );
          }
        }
      }
      // Check for orphaned node_modules
      const nodeModulesPath = path.join(process.cwd(), "node_modules");
      if (fs.existsSync(nodeModulesPath)) {
        const installed = fs
          .readdirSync(nodeModulesPath)
          .filter((f) => !f.startsWith("."));
        const allDeclared = [...Object.keys(deps), ...Object.keys(devDeps)];
        const orphaned = installed.filter(
          (name) => !allDeclared.includes(name),
        );
        if (orphaned.length > 0) {
          console.log(
            chalk.yellow(
              "\nOrphaned packages in node_modules (not listed in package.json):",
            ),
          );
          for (const name of orphaned) {
            console.log(chalk.yellow(`  ${name}`));
          }
        }
      }
      console.log();
      return;
    }
    if (command === "clean") {
      // Plugin hook
      for (const plugin of plugins) {
        if (typeof plugin.beforeClean === "function") {
          await plugin.beforeClean({ context: { cwd: process.cwd() } });
        }
      }
      let removed = false;
      async function tryRemove(target) {
        try {
          await fs.rm(target, { recursive: true, force: true });
          console.log(chalk.green(`Removed ${target}`));
          removed = true;
        } catch (err) {
          // Only print if not ENOENT
          if (err.code !== "ENOENT") {
            console.log(
              chalk.red(
                `Failed to remove ${target}: ${err.message}`,
              ),
            );
          }
        }
      }
      await tryRemove(path.join(process.cwd(), "node_modules"));
      await tryRemove(path.join(process.cwd(), ".cache"));
      await tryRemove(path.join(process.cwd(), "node_modules", ".cache"));
      if (!removed) {
        console.log(chalk.yellow("Nothing to clean."));
      }
      // Plugin hook
      for (const plugin of plugins) {
        if (typeof plugin.afterClean === "function") {
          await plugin.afterClean({ context: { cwd: process.cwd() } });
        }
      }
      return;
    }
    if (command === "outdated") {
      const pkg = await readPackageJson();
      const deps = pkg.dependencies || {};
      const devDeps = pkg.devDependencies || {};
      const all = { ...deps, ...devDeps };
      const axios = require("axios");
      const semver = require("semver");
      const pad = (str, len) => str + " ".repeat(Math.max(0, len - str.length));
      const { readLockfile } = require("./readLockfile");
      const lock = await readLockfile();
      if (Object.keys(all).length === 0) {
        console.log(chalk.yellow("No dependencies found."));
        return;
      }
      console.log(chalk.bold("\nOutdated dependencies:"));
      console.log(
        pad("Package", 25) + pad("Current", 15) + pad("Latest", 15) + "Status",
      );
      for (const [name, current] of Object.entries(all)) {
        try {
          const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
          const { data } = await axios.get(url);
          const latest = data["dist-tags"].latest;
          let status = "";
          let installed = null;
          if (lock && lock[name] && lock[name].version) {
            installed = lock[name].version;
          }
          if (current === "latest" && installed) {
            if (semver.eq(installed, latest)) {
              status = chalk.green("Up to date");
            } else if (semver.lt(installed, latest)) {
              status = chalk.red("Outdated");
            } else {
              status = chalk.yellow("Unknown");
            }
            console.log(
              pad(name, 25) + pad(installed, 15) + pad(latest, 15) + status,
            );
            continue;
          }
          if (
            semver.validRange(current) &&
            semver.lt(semver.minVersion(current), latest)
          ) {
            status = chalk.red("Outdated");
          } else {
            status = chalk.green("Up to date");
          }
          console.log(
            pad(name, 25) + pad(current, 15) + pad(latest, 15) + status,
          );
        } catch (err) {
          console.log(
            pad(name, 25) +
              pad(current, 15) +
              pad("-", 15) +
              chalk.yellow("Error fetching latest"),
          );
        }
      }
      console.log();
      return;
    }
    if (command === "info") {
      const axios = require("axios");
      if (!rest[0]) {
        console.log("Usage: blaze info <package>");
        return;
      }
      const pkgName = rest[0];
      try {
        const url = `https://registry.npmjs.org/${encodeURIComponent(pkgName)}`;
        const { data } = await axios.get(url);
        const latest = data["dist-tags"].latest;
        const info = data.versions[latest];
        console.log(chalk.bold(`\n${pkgName}`));
        console.log(chalk.green("Latest version:"), latest);
        if (info.description)
          console.log(
            chalk.green("Description:"),
            info.description,
          );
        if (info.homepage)
          console.log(chalk.green("Homepage:"), info.homepage);
        if (info.repository && info.repository.url)
          console.log(
            chalk.green("Repository:"),
            info.repository.url.replace(/^git\+/, ""),
          );
        if (info.license)
          console.log(chalk.green("License:"), info.license);
        if (info.maintainers) {
          const maintainers = Array.isArray(info.maintainers)
            ? info.maintainers.map((m) => m.name).join(", ")
            : info.maintainers;
          console.log(chalk.green("Maintainers:"), maintainers);
        }
        console.log();
      } catch (err) {
        console.log(
          chalk.red("Error fetching info for"),
          pkgName,
          "-",
          err.message,
        );
      }
      return;
    }
    if (command === "publish") {
      // Run prepublish, prepare, prepack, postpack, postpublish scripts
      await runLifecycleScript(process.cwd(), "prepublish", "");
      await runLifecycleScript(process.cwd(), "prepare", "");
      await runLifecycleScript(process.cwd(), "prepack", "");
      await publishPackage();
      await runLifecycleScript(process.cwd(), "postpack", "");
      await runLifecycleScript(process.cwd(), "postpublish", "");
      return;
    }
    if (command === "version") {
      if (!rest[0]) {
        console.log("Usage: blaze version <newversion>");
        return;
      }
      // Run preversion, version, postversion scripts
      await runLifecycleScript(process.cwd(), "preversion", "");
      await bumpVersion(rest[0]);
      await runLifecycleScript(process.cwd(), "version", "");
      await runLifecycleScript(process.cwd(), "postversion", "");
      return;
    }
    if (command === "run") {
      if (!rest[0]) {
        console.log("Usage: blaze run <script>");
        return;
      }
      await runScript(rest[0]);
      return;
    }
    if (command === "graph") {
      await generateDependencyGraph();
      return;
    }
    if (command === "link") {
      if (rest[0]) {
        await blazeLinkInstall(rest[0]);
      } else {
        await blazeLink();
      }
      return;
    }
    if (command === "unlink") {
      await blazeUnlink();
      return;
    }
    if (command === "audit") {
      // Plugin hook
      for (const plugin of plugins) {
        if (typeof plugin.beforeAudit === "function") {
          await plugin.beforeAudit({ context: { cwd: process.cwd() } });
        }
      }
      await auditPackages();
      // Plugin hook
      for (const plugin of plugins) {
        if (typeof plugin.afterAudit === "function") {
          await plugin.afterAudit({ context: { cwd: process.cwd() } });
        }
      }
      return;
    }
    if (command === "doctor") {
      const fix = args.includes("--fix");
      const diagnostics = require("./diagnostics");
      await diagnostics.runDoctor(fix);
      return;
    }
    if (command === "clean-github-specs") {
      await cleanGithubSpecs();
      process.exit(0);
    }
    console.log("Welcome to blaze-install!");
    console.log("Arguments:", args);
    if (command === "install" || command === undefined) {
      const offline = args.includes("--offline");
      const auditFix = args.includes("--audit-fix");
      const noLockfile = args.includes("--no-lockfile");
      const workspaceFlagIndex = args.findIndex((arg) => arg === "--workspace");
      let workspaceTarget = null;
      if (workspaceFlagIndex !== -1 && args[workspaceFlagIndex + 1]) {
        workspaceTarget = args[workspaceFlagIndex + 1];
      }
      // Filter out CLI flags from rest (package names)
      const rest = args.filter(
        (arg) => !arg.startsWith("--") && arg !== command,
      );
      if (auditFix && noLockfile) {
        console.error(
          "Error: --audit-fix cannot be used with --no-lockfile. The audit requires a lockfile.",
        );
        process.exit(1);
      }
      for (const plugin of plugins) {
        if (typeof plugin.beforeInstall === "function") {
          await plugin.beforeInstall({ args, context: { cwd: process.cwd() } });
        }
      }
      let addingPackage = rest.length >= 1 && rest[0];
      let pkgName, range, versionOrRange;
      let targetPkgPath = path.resolve(process.cwd(), "package.json");
      let rootPkg = await readPackageJson();
      let isMonorepo =
        Array.isArray(rootPkg.workspaces) && rootPkg.workspaces.length > 0;
      let workspaceChoices = [];
      if (isMonorepo) {
        // Find all workspace package.json files
        for (const wsGlob of rootPkg.workspaces) {
          const wsAbsPath = path.resolve(process.cwd(), wsGlob);
          const wsPkgPath = path.join(wsAbsPath, "package.json");
          try {
            await fs.access(wsPkgPath);
            workspaceChoices.push({ name: wsGlob, value: wsPkgPath });
          } catch {}
        }
        // Add root as a choice
        workspaceChoices.unshift({
          name: "[root]",
          value: path.resolve(process.cwd(), "package.json"),
        });
      }
      // If adding a package, determine the target package.json
      if (addingPackage && rest[0]) {
        ({ name: pkgName, range } = parsePackageArg(rest[0]));
        versionOrRange = await resolveVersionOrRange(pkgName, range, {
          offline,
        });
        // If --workspace flag is used
        if (workspaceTarget) {
          const found = workspaceChoices.find(
            (w) =>
              w.name === workspaceTarget || w.value.includes(workspaceTarget),
          );
          if (found) {
            targetPkgPath = found.value;
          } else {
            console.error(`Workspace '${workspaceTarget}' not found.`);
            process.exit(1);
          }
        } else if (isMonorepo) {
          // If inside a workspace, use that workspace
          const cwd = process.cwd();
          const found = workspaceChoices.find(
            (w) =>
              cwd.startsWith(path.dirname(w.value)) &&
              w.value !== path.resolve(process.cwd(), "package.json"),
          );
          if (found) {
            targetPkgPath = found.value;
          } else {
            // Prompt user to select target
            const inquirer = (await import("inquirer")).default;
            const { chosen } = await inquirer.prompt([
              {
                type: "list",
                name: "chosen",
                message: "Which workspace should this dependency be added to?",
                choices: workspaceChoices,
              },
            ]);
            targetPkgPath = chosen;
          }
        }
        // Add dependency to the selected package.json
        const targetPkg = JSON.parse(await fs.readFile(targetPkgPath, "utf-8"));
        const dev = saveDev;
        if (dev) {
          targetPkg.devDependencies = targetPkg.devDependencies || {};
          targetPkg.devDependencies[pkgName] = versionOrRange;
          console.log(
            `Added ${pkgName}@${versionOrRange} to devDependencies in ${targetPkgPath}`,
          );
        } else {
          targetPkg.dependencies = targetPkg.dependencies || {};
          targetPkg.dependencies[pkgName] = versionOrRange;
          console.log(
            `Added ${pkgName}@${versionOrRange} to dependencies in ${targetPkgPath}`,
          );
        }
        await fs.writeFile(
          targetPkgPath,
          JSON.stringify(targetPkg, null, 2),
          "utf-8",
        );
      }
      // Now, always re-read all workspace and root package.json files for dependency resolution
      let rootPkgLatest = await readPackageJson();
      let depsToInstall = {};
      let workspacePaths = [];
      const ciMode = args.includes("--ci");
      if (ciMode) {
        const tryRemove = async (target) => {
          try {
            await fs.rm(target, { recursive: true, force: true });
          } catch {}
        };
        await tryRemove(path.join(process.cwd(), "node_modules"));
      }
      if (rootPkgLatest.workspaces && Array.isArray(rootPkgLatest.workspaces)) {
        console.log("Detected workspaces:", rootPkgLatest.workspaces);
        // Always re-read all workspace package.json files for dependency resolution
        const {
          allDeps,
          allDevDeps,
          workspacePaths: wsPaths,
        } = await readWorkspacePackageJsons(rootPkgLatest.workspaces);
        workspacePaths = wsPaths;
        if (production) {
          depsToInstall = { ...(rootPkgLatest.dependencies || {}), ...allDeps };
        } else {
          depsToInstall = {
            ...(rootPkgLatest.dependencies || {}),
            ...(rootPkgLatest.devDependencies || {}),
            ...allDeps,
            ...allDevDeps,
          };
        }
      } else {
        if (production) {
          depsToInstall = rootPkgLatest.dependencies || {};
        } else {
          depsToInstall = {
            ...(rootPkgLatest.dependencies || {}),
            ...(rootPkgLatest.devDependencies || {}),
          };
        }
      }
      const hasLocalDeps = Object.values(depsToInstall).some(
        (v) =>
          typeof v === "string" &&
          (v.startsWith("file:") || v.startsWith("link:")),
      );
      let lock = null;
      if (!noLockfile && !hasLocalDeps) {
        lock = await readLockfile();
      }
      if (addingPackage) {
        // Always resolve and update lockfile when adding a package
        console.log(chalk.blue("✨ Adding new package. Resolving dependencies and updating lockfile..."));
        if (Object.keys(depsToInstall).length > 0) {
          const spinner = new Spinner("Resolving dependencies");
          spinner.start();
          const tree = await resolveDependencies(
            depsToInstall,
            {},
            null,
            [],
            [],
            { offline },
          );
          spinner.stop("Dependencies resolved.");

          // Peer dependency handling
          if (tree.peerWarnings && tree.peerWarnings.length > 0 && !offline) {
            console.log(chalk.yellow("\n⚠️ Peer dependency warnings:"));
            for (const w of tree.peerWarnings) console.log(chalk.yellow(`  - ${w}`));
            // Collect all missing and mismatched peers
            const missingPeers = tree.peerWarnings
              .filter((w) => w.startsWith("Peer dependency missing:"))
              .map((w) => w.match(/requires ([^@]+)@/)[1]);
            const mismatchedPeers = tree.peerWarnings
              .filter((w) => w.startsWith("Peer dependency version mismatch:"))
              .map((w) => w.match(/requires ([^@]+)@/)[1]);
            const allPeers = Array.from(
              new Set([...missingPeers, ...mismatchedPeers]),
            );
            if (allPeers.length > 0) {
              const inquirer = (await import("inquirer")).default;
              const { autoInstall } = await inquirer.prompt([
                {
                  type: "confirm",
                  name: "autoInstall",
                  message: chalk.blue(`Auto-install missing or mismatched peer dependencies (${allPeers.join(", ")})?`),
                  default: false,
                },
              ]);
              if (autoInstall) {
                for (const peer of allPeers) {
                  await resolveVersionOrRange(peer, "latest", { offline });
                  // Add to depsToInstall and re-run install
                  depsToInstall[peer] = "latest";
                }
                // Re-run install with updated deps
                const spinner2 = new Spinner("Resolving peer dependencies");
                spinner2.start();
                const tree2 = await resolveDependencies(
                  depsToInstall,
                  {},
                  null,
                  [],
                  [],
                  { offline },
                );
                spinner2.stop("Peer dependencies resolved.");
                await installTree(tree2, process.cwd(), { useSymlinks });
                if (!noLockfile) {
                  await writeLockfile(tree2);
                  console.log(chalk.green("blaze-lock.json written!"));
                }
              }
            }
          }
          if (args.includes("--debug")) {
            console.log(chalk.gray("[DEBUG] Full resolved dependency tree:"), tree);
          } else {
            console.log(
              chalk.gray(`[DEBUG] Dependency tree resolved. Top-level packages: ${Object.keys(tree).join(", ")}`),
            );
          }
          console.log(chalk.blue("📦 Installing packages..."));
          await installTree(tree, process.cwd(), { useSymlinks });
          console.log(chalk.green("✔ All packages installed!"));
          if (!noLockfile) {
            await writeLockfile(tree);
            console.log(chalk.green("blaze-lock.json written!"));
          }
        } else {
          console.log(chalk.yellow("No dependencies found in package.json."));
        }
      } else if (lock && !noLockfile) {
        if (Object.keys(lock).length === 0) {
          console.log(chalk.yellow("No dependencies to install. Skipping install."));
          return;
        }
        console.log(chalk.blue("🔒 blaze-lock.json found. Installing from lockfile..."));
        await installTree(lock, process.cwd(), { useSymlinks });
        console.log(chalk.green("✔ All packages installed from lockfile!"));
      } else {
        // No lockfile or lockfile skipped, resolve and install
        console.log(
          chalk.blue("✨ No blaze-lock.json found or lockfile skipped. Resolving dependencies..."),
        );
        if (Object.keys(depsToInstall).length > 0) {
          const spinner = new Spinner("Resolving dependencies");
          spinner.start();
          const tree = await resolveDependencies(
            depsToInstall,
            {},
            null,
            [],
            [],
            { offline },
          );
          spinner.stop("Dependencies resolved.");
          console.log(chalk.gray("[DEBUG] Resolved dependency tree:"), tree);
          console.log(chalk.blue("📦 Installing packages..."));
          await installTree(tree, process.cwd(), { useSymlinks });
          console.log(chalk.green("✔ All packages installed!"));
          if (!noLockfile) {
            await writeLockfile(tree);
            console.log(chalk.green("blaze-lock.json written!"));
          }
        } else {
          console.log(chalk.yellow("No dependencies found in package.json."));
        }
      }
      for (const plugin of plugins) {
        if (typeof plugin.afterInstall === "function") {
          await plugin.afterInstall({ args, context: { cwd: process.cwd() } });
        }
      }
      // console.log("DEBUG: auditFix:", auditFix, "noLockfile:", noLockfile);
      if (auditFix && noLockfile) {
        console.error(
          chalk.red("Error: --audit-fix cannot be used with --no-lockfile. The audit requires a lockfile."),
        );
        process.exit(1);
      }
      if (offline) {
        console.log(chalk.blue("Offline mode enabled: will only use local cache."));
      }

      // Install Summary
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000_000; // seconds
      const installedCount = Object.keys(depsToInstall).length;
      console.log(boxen(
        chalk.bold.white(`Installation Summary`) +
        `\n\n${chalk.green('✔')} Installed ${installedCount} packages` +
        `\n${chalk.blue('⏱')} Time taken: ${duration.toFixed(2)}s`,
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'green',
          backgroundColor: 'black',
          align: 'center',
        }
      ));
    }
  } catch (err) {
    console.error(
      chalk.red("❌ Error:"),
      err && err.stack ? chalk.red(err.stack) : chalk.red(err),
    );
    process.exit(1);
  }
}

// Add startTime at the beginning of main function
const startTime = process.hrtime.bigint();

module.exports = { main, printHelp };

module.exports = { main, printHelp };
