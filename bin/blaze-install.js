#!/usr/bin/env node

const { main, printHelp } = require('../lib/index');
let chalk;
async function getChalk() {
  if (!chalk) {
    chalk = (await import('chalk')).default;
  }
  return chalk;
}

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === '--help' || command === 'help') {
  printHelp();
  process.exit(0);
}

// Supported commands (add more as you implement them)
const supported = [
  'install',
  'uninstall',
  'update',
  'audit',
  'list',
  'clean',
  'outdated',
  'info',
  '--interactive',
  'publish',
  'version',
  'audit fix',
  'run',
  'link',
  'unlink',
  'graph',
  'upgrade',
  'doctor',
  'prefetch',
  'watch',
];

if (supported.includes(command)) {
  if (command === 'watch') {
    // --- blaze watch: auto-install missing packages on code change ---
    const chokidar = require('chokidar');
    const fs = require('fs');
    const path = require('path');
    const { execSync } = require('child_process');
    const glob = require('glob');
    const watchedExts = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.mts', '.cts', '.json', '.vue'];
    const ignored = /node_modules|\.git|plugins|\.blaze|dist|build|out|coverage|\.next|\.cache|\.vscode/;
    const pkgJson = fs.existsSync('package.json') ? JSON.parse(fs.readFileSync('package.json', 'utf8')) : {};
    let installed = new Set([
      ...Object.keys(pkgJson.dependencies || {}),
      ...Object.keys(pkgJson.devDependencies || {})
    ]);
    let pending = new Set();
    let batchTimeout = null;
    // Node.js core modules to skip
    const nodeCoreModules = new Set([
      'assert','buffer','child_process','cluster','console','constants','crypto','dgram','dns','domain','events','fs','http','https','module','net','os','path','perf_hooks','process','punycode','querystring','readline','repl','stream','string_decoder','timers','tls','tty','url','util','v8','vm','zlib','inspector','async_hooks','worker_threads','trace_events','http2','diagnostics_channel','wasi','node:assert','node:buffer','node:child_process','node:cluster','node:console','node:constants','node:crypto','node:dgram','node:dns','node:domain','node:events','node:fs','node:http','node:https','node:module','node:net','node:os','node:path','node:perf_hooks','node:process','node:punycode','node:querystring','node:readline','node:repl','node:stream','node:string_decoder','node:timers','node:tls','node:tty','node:url','node:util','node:v8','node:vm','node:zlib','node:inspector','node:async_hooks','node:worker_threads','node:trace_events','node:http2','node:diagnostics_channel','node:wasi'
    ]);
    function extractPackages(code) {
      const requireRegex = /require\(['"]([^'"/]+)['"]\)/g;
      const importRegex = /import\s+.*?from\s+['"]([^'"/]+)['"]/g;
      const pkgs = new Set();
      let m;
      while ((m = requireRegex.exec(code))) pkgs.add(m[1]);
      while ((m = importRegex.exec(code))) pkgs.add(m[1]);
      // Filter out relative imports and Node core modules
      return Array.from(pkgs).filter(p => !p.startsWith('.') && !p.startsWith('/') && !nodeCoreModules.has(p));
    }
    function batchInstall() {
      if (pending.size === 0) return;
      const pkgs = Array.from(pending).filter(pkg => !installed.has(pkg));
      if (pkgs.length === 0) return;
      console.log(`[blaze-watch] Installing missing packages: ${pkgs.join(', ')}`);
      try {
        execSync(`node bin/blaze-install.js install ${pkgs.join(' ')}`, { stdio: 'inherit' });
        pkgs.forEach(pkg => installed.add(pkg));
      } catch (e) {
        console.warn(`[blaze-watch] Failed to install some packages:`, e.message);
      }
      pending.clear();
    }
    // --- Initial scan for missing packages ---
    const globPattern = `**/*.{${watchedExts.map(e=>e.replace('.','')).join(',')}}`;
    const files = glob.sync(globPattern, { ignore: ['**/node_modules/**','**/.git/**','**/plugins/**','**/.blaze/**','**/dist/**','**/build/**','**/out/**','**/coverage/**','**/.next/**','**/.cache/**','**/.vscode/**'] });
    const allPkgs = new Set();
    for (const file of files) {
      try {
        const code = fs.readFileSync(file, 'utf8');
        extractPackages(code).forEach(pkg => allPkgs.add(pkg));
      } catch {}
    }
    const missing = Array.from(allPkgs).filter(pkg => !installed.has(pkg));
    if (missing.length) {
      console.log(`[blaze-watch] Detected missing packages on startup: ${missing.join(', ')}`);
      try {
        execSync(`node bin/blaze-install.js install ${missing.join(' ')}`, { stdio: 'inherit' });
        missing.forEach(pkg => installed.add(pkg));
      } catch (e) {
        console.warn(`[blaze-watch] Failed to install some packages on startup:`, e.message);
      }
    }
    // --- Start watcher as before ---
    chokidar.watch('.', { ignored, persistent: true })
      .on('change', file => {
        if (!watchedExts.some(ext => file.endsWith(ext))) return;
        console.log(`[blaze-watch] Detected change in: ${file}`);
        const code = fs.readFileSync(file, 'utf8');
        const pkgs = extractPackages(code);
        pkgs.forEach(pkg => {
          if (!installed.has(pkg)) pending.add(pkg);
        });
        if (batchTimeout) clearTimeout(batchTimeout);
        batchTimeout = setTimeout(batchInstall, 1000); // batch within 1s window
      });
    console.log('[blaze-watch] Watching for new imports/requires in all supported file types...');
    return;
  }
  (async () => {
    try {
      await main(args);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
} else {
  console.log('Unknown command:', command);
  printHelp();
  process.exit(1);
} 