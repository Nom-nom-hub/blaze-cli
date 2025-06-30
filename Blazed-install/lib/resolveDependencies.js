const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const semver = require('semver');
const registryService = require('./registryService');

const CACHE_DIR = path.join(os.homedir(), '.blaze_cache');

// Platform detection for cross-platform consistency
function getCurrentPlatform() {const platform = process.platform;
  const arch = process.arch;
  
  // Map Node.js platform/arch to npm-style platform identifiers
  const platformMap = {
    'win32': 'win32',
    'darwin': 'darwin', 
    'linux': 'linux'
  };
  
  const archMap = {
    'x64': 'x64',
    'arm64': 'arm64',
    'ia32': 'ia32'
  };
  
  return {
    platform: platformMap[platform] || platform,
    arch: archMap[arch] || arch,
    // Combined identifier like 'win32-x64', 'darwin-arm64', etc.
    combined: `${platformMap[platform] || platform}-${archMap[arch] || arch}`
  };
}

// Check if a package name indicates it's platform-specific
function isPlatformSpecificPackage(packageName) {const platformPatterns = [
    /^@.*\/(win32|darwin|linux)-(x64|arm64|ia32)/,
    /^@.*\/(win32|darwin|linux)/,
    /^@.*\/(x64|arm64|ia32)/,
    /^.*-(win32|darwin|linux)-(x64|arm64|ia32)/,
    /^.*-(win32|darwin|linux)/,
    /^.*-(x64|arm64|ia32)$/
  ];
  
  return platformPatterns.some(pattern => pattern.test(packageName));
}

// Check if a package is compatible with the current platform
function isPackageCompatible(packageName) {if (!isPlatformSpecificPackage(packageName)) {
    return true; // Non-platform-specific packages are always compatible
  }
  
  const currentPlatform = getCurrentPlatform();
  
  // Check if package name contains current platform/arch
  const platformMatch = packageName.includes(currentPlatform.platform);
  const archMatch = packageName.includes(currentPlatform.arch);
  const combinedMatch = packageName.includes(currentPlatform.combined);
  
  // For packages with both platform and arch, both must match
  if (packageName.includes('-') && (packageName.includes('win32') || packageName.includes('darwin') || packageName.includes('linux'))) {
    return combinedMatch;
  }
  
  // For packages with only platform or only arch, check accordingly
  return platformMatch || archMatch;
}

async function ensureCacheDir() {await fs.mkdir(CACHE_DIR, { recursive: true });
}

async function fetchPackageMeta(name, { offline = false } = {}) {await ensureCacheDir();
  const cachePath = path.join(CACHE_DIR, `metadata-${name.replace('/', '_')}.json`);
  try {
    const data = await fs.readFile(cachePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    if (offline) {throw new Error(`Offline mode: metadata for ${name} not found in cache (${cachePath})`);
    }
    
    // Use registry service instead of hardcoded URL
    const data = await registryService.getPackageMetadata(name);
    await fs.writeFile(cachePath, JSON.stringify(data), 'utf-8');
    return data;
  }
}

const CONCURRENCY = 8;

// Enhanced dependency resolution with intelligent deduplication
async function resolveDependencies(dependencies, resolved = {}, parent = null, peerWarnings = [], optionalWarnings = [], options = {}) {const entries = Object.entries(dependencies);
  let idx = 0;
  
  // Track version conflicts for deduplication
  const versionConflicts = new Map(); // package name -> Set of versions
  
  async function worker([name, versionRange]) {if (resolved[name]) {// Check for version conflicts
      if (!versionConflicts.has(name)) {
        versionConflicts.set(name, new Set());
      }
      versionConflicts.get(name).add(resolved[name].version);
      return;
    }
    
    // Handle file: and link: dependencies directly
    if (typeof versionRange === 'string' && (versionRange.startsWith('file:') || versionRange.startsWith('link:'))) {
      resolved[name] = { 
        version: versionRange, 
        dependencies: {},
        parent,
        resolved: versionRange,
        type: 'local'
      };
      return;
    }
    
    const meta = await fetchPackageMeta(name, options);
    
    // Intelligent version selection
    let selectedVersion;
    if (versionRange === 'latest' || !versionRange) {selectedVersion = meta['dist-tags'].latest;
    } else if (meta['dist-tags'][versionRange]) {
      selectedVersion = meta['dist-tags'][versionRange];
    } else {
      // Find the best version that satisfies the range
      const versions = Object.keys(meta.versions).sort(semver.compare);
      selectedVersion = semver.maxSatisfying(versions, versionRange);
      
      if (!selectedVersion) {// If no version satisfies the range, try to find a compatible version
        console.warn(`[WARNING] No version found for ${name} satisfying ${versionRange}. Trying to find compatible version...`);
        
        // Try to find a version that's close to the range
        const latestVersion = meta['dist-tags'].latest;
        if (latestVersion) {selectedVersion = latestVersion;
          console.warn(`[WARNING] Using latest version ${latestVersion} for ${name} instead of ${versionRange}`);
        } else {
          // Last resort: use the highest available version
          selectedVersion = versions[versions.length - 1];
          console.warn(`[WARNING] Using highest available version ${selectedVersion} for ${name} instead of ${versionRange}`);
        }
      }
    }
    
    const pkg = meta.versions[selectedVersion];
    
    resolved[name] = {
      version: selectedVersion,
      dependencies: pkg.dependencies || {},
      parent,
      resolved: selectedVersion,
      type: 'registry',
      integrity: pkg.dist?.integrity || null,
      tarballUrl: pkg.dist?.tarball || null,
      platform: process.platform,
      arch: process.arch
    };
    
    // Track version conflicts
    if (!versionConflicts.has(name)) {
      versionConflicts.set(name, new Set());
    }
    versionConflicts.get(name).add(selectedVersion);
    
    // Peer dependencies: warn if missing or incompatible
    if (pkg.peerDependencies) {for (const [peerName, peerRange] of Object.entries(pkg.peerDependencies)) {
        const found = resolved[peerName];
        if (!found) {peerWarnings.push(`Peer dependency missing: ${name}@${selectedVersion} requires ${peerName}@${peerRange}`);
        } else if (!semver.satisfies(found.version, peerRange)) {
          peerWarnings.push(`Peer dependency version mismatch: ${name}@${selectedVersion} requires ${peerName}@${peerRange}, found ${found.version}`);
        }
      }
    }
    
    // Optional dependencies: try to resolve, but filter by platform compatibility
    if (pkg.optionalDependencies) {for (const [optName, optRange] of Object.entries(pkg.optionalDependencies)) {
        // Skip platform-specific optional dependencies that don't match current platform
        if (isPlatformSpecificPackage(optName) && !isPackageCompatible(optName)) {
          optionalWarnings.push(`Skipping platform-specific optional dependency: ${name}@${selectedVersion} optional ${optName}@${optRange} (incompatible with ${getCurrentPlatform().combined})`);
          continue;
        }
        
        try {
          if (!resolved[optName]) {await worker([optName, optRange]);
          }
        } catch (err) {
          optionalWarnings.push(`Optional dependency failed: ${name}@${selectedVersion} optional ${optName}@${optRange} (${err.message})`);
        }
      }
    }
    
    // Recursively resolve sub-dependencies
    await resolveDependencies(pkg.dependencies || {}, resolved, name, peerWarnings, optionalWarnings, options);
  }
  
  async function runBatch() {const batch = [];
    for (let c = 0; c < CONCURRENCY && idx < entries.length; c++, idx++) {batch.push(worker(entries[idx]));
    }
    await Promise.all(batch);
    if (idx < entries.length) {await runBatch();
    }
  }
  
  await runBatch();
  
  // Deduplication: resolve version conflicts
  const deduplicatedTree = await deduplicateVersions(resolved, versionConflicts);
  
  // Print peer/optional warnings at the end (only at the top level)
  if (parent === null) {if (peerWarnings.length > 0) {console.warn('\nPeer dependency warnings:');
      for (const w of peerWarnings) console.warn('  - ' + w);
    }
    if (optionalWarnings.length > 0) {console.warn('\nOptional dependency warnings:');
      for (const w of optionalWarnings) console.warn('  - ' + w);
    }
  }
  
  // Return both the resolved tree and warnings
  return {
    tree: deduplicatedTree,
    peerWarnings,
    optionalWarnings,
    versionConflicts: Array.from(versionConflicts.entries()).filter(([_, versions]) => versions.size > 1)
  };
}

// Deduplicate versions by selecting the best compatible version
async function deduplicateVersions(resolved, versionConflicts) {const deduplicated = {};
  
  for (const [name, versions] of versionConflicts.entries()) {
    if (versions.size === 1) {// No conflict, use the single version
      deduplicated[name] = resolved[name];
    } else {
      // Version conflict - select the best version
      const versionArray = Array.from(versions).sort(semver.compare);
      const bestVersion = versionArray[versionArray.length - 1]; // Use highest version
      
      // Find the package info for the best version
      for (const [pkgName, pkgInfo] of Object.entries(resolved)) {
        if (pkgName === name && pkgInfo.version === bestVersion) {deduplicated[name] = pkgInfo;
          break;
        }
      }
      
      if (versionArray.length > 1) {console.warn(`[DEDUPLICATION] Resolved version conflict for ${name}: ${Array.from(versions).join(', ')} -> ${bestVersion}`);
      }
    }
  }
  
  return deduplicated;
}

module.exports = { resolveDependencies, getCurrentPlatform, isPlatformSpecificPackage, isPackageCompatible }; 