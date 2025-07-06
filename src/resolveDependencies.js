const axios = require("axios");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const semver = require("semver");
const chalk = require('chalk');
const { resolveNpmAlias } = require("./utils");

const CACHE_DIR = path.join(os.homedir(), ".blaze_cache");

const isVerbose = process.argv.includes('--verbose');

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

async function fetchPackageMeta(name, { offline = false } = {}) {
  await ensureCacheDir();
  const cachePath = path.join(
    CACHE_DIR,
    `metadata-${name.replace("/", "_")}.json`,
  );
  try {
    const data = await fs.readFile(cachePath, "utf-8");
    return JSON.parse(data);
  } catch {
    if (offline) {
      throw new Error(
        `Offline mode: metadata for ${name} not found in cache (${cachePath})`,
      );
    }
    const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
    const { data } = await axios.get(url);
    await fs.writeFile(cachePath, JSON.stringify(data), "utf-8");
    return data;
  }
}

const CONCURRENCY = 8;

function isGithubOrTarballSpec(spec) {
  return (
    typeof spec === "string" &&
    (/^github:[^/]+\/[^#]+(#.+)?$/.test(spec) ||
      /^[^/]+\/[^#]+(#.+)?$/.test(spec) ||
      /^https?:\/\/.+\.(tgz|tar\.gz)$/.test(spec))
  );
}

async function resolveDependencies(
  dependencies,
  resolved = {},
  parent = null,
  peerWarnings = [],
  optionalWarnings = [],
  options = {},
) {
  const entries = Object.entries(dependencies);
  let idx = 0;
  async function worker([name, versionRange]) {
    if (resolved[name]) return; // Avoid cycles
    // Handle file:, link:, and GitHub/tarball dependencies directly
    if (
      typeof versionRange === "string" &&
      (versionRange.startsWith("file:") ||
        versionRange.startsWith("link:") ||
        isGithubOrTarballSpec(versionRange))
    ) {
      resolved[name] = { version: versionRange, dependencies: {} };
      return;
    }
    // Handle npm alias: alias@npm:real-pkg@range
    if (await resolveNpmAlias(name, versionRange, worker, resolved)) {
      return;
    }
    const meta = await fetchPackageMeta(name, options);
    // Handle special cases like "latest" tag
    let resolvedVersion;
    if (versionRange === "latest") {
      resolvedVersion = meta["dist-tags"].latest;
    } else {
      // Use semver.maxSatisfying to find the highest version that satisfies the range
      const availableVersions = Object.keys(meta.versions);
      resolvedVersion = semver.maxSatisfying(availableVersions, versionRange);
      if (!resolvedVersion) {
        throw new Error(`No version found for ${name}@${versionRange}. Available versions: ${availableVersions.slice(-5).join(', ')}`);
      }
    }
    const pkg = meta.versions[resolvedVersion];
    // If the version is a GitHub/tarball spec, pass it through as-is for installTree to handle
    resolved[name] = {
      version: resolvedVersion,
      dependencies: pkg.dependencies || {},
      parent,
    };
    // Peer dependencies: warn if missing or incompatible
    if (pkg.peerDependencies) {
      for (const [peerName, peerRange] of Object.entries(
        pkg.peerDependencies,
      )) {
        const found = resolved[peerName];
        if (!found) {
          peerWarnings.push(
            `Peer dependency missing: ${name}@${resolvedVersion} requires ${peerName}@${peerRange}`,
          );
        } else if (!semver.satisfies(found.version, peerRange)) {
          peerWarnings.push(
            `Peer dependency version mismatch: ${name}@${resolvedVersion} requires ${peerName}@${peerRange}, found ${found.version}`,
          );
        }
      }
    }
    // Optional dependencies: try to resolve, ignore errors
    if (pkg.optionalDependencies) {
      for (const [optName, optRange] of Object.entries(
        pkg.optionalDependencies,
      )) {
        try {
          if (!resolved[optName]) {
            await worker([optName, optRange]);
          }
        } catch (err) {
          optionalWarnings.push(
            `Optional dependency failed: ${name}@${resolvedVersion} optional ${optName}@${optRange} (${err.message})`,
          );
        }
      }
    }
    // Recursively resolve sub-dependencies
    await resolveDependencies(
      pkg.dependencies || {},
      resolved,
      name,
      peerWarnings,
      optionalWarnings,
      options,
    );
  }
  async function runBatch() {
    const batch = [];
    for (let c = 0; c < CONCURRENCY && idx < entries.length; c++, idx++) {
      batch.push(worker(entries[idx]));
    }
    await Promise.all(batch);
    if (idx < entries.length) {
      await runBatch();
    }
  }
  await runBatch();
  // Print peer/optional warnings at the end (only at the top level)
  if (parent === null) {
    if (isVerbose) {
    if (peerWarnings.length > 0) {
        console.warn(chalk.yellow.bold('⚠️ Peer dependency warnings:'));
        for (const w of peerWarnings) console.warn(chalk.yellow('  - ' + w));
    }
    if (optionalWarnings.length > 0) {
        console.warn(chalk.yellow.bold('⚠️ Optional dependency warnings:'));
        for (const w of optionalWarnings) console.warn(chalk.yellow('  - ' + w));
      }
    }
  }
  return resolved;
}

module.exports = { resolveDependencies };
