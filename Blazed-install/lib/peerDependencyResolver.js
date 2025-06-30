const semver = require('semver');
const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

const CACHE_DIR = path.join(os.homedir(), '.blaze_cache');

class PeerDependencyResolver {
  constructor() {this.peerWarnings = [];
    this.resolvedPeers = new Map(); // peer name -> resolved version
  }

  // Extract peer dependency requirements from warnings
  extractPeerRequirements(warnings) {const requirements = new Map(); // peer name -> Set of required ranges
    
    for (const warning of warnings) {if (warning.startsWith('Peer dependency missing:')) {
        const match = warning.match(/Peer dependency missing: ([^@]+)@([^)]+)/);
        if (match) {const [, peerName, peerRange] = match;
          if (!requirements.has(peerName)) {
            requirements.set(peerName, new Set());
          }
          requirements.get(peerName).add(peerRange);
        }
      }
    }
    
    return requirements;
  }

  // Resolve peer dependencies to compatible versions
  async resolvePeerDependencies(peerRequirements, existingDeps = {}) {
    console.log('[DEBUG] Resolving peer dependencies...');
    
    const resolved = new Map();
    
    for (const [peerName, ranges] of peerRequirements) {// Check if already resolved
      if (existingDeps[peerName]) {resolved.set(peerName, existingDeps[peerName]);
        continue;
      }
      
      // Find a version that satisfies all ranges
      const compatibleVersion = await this.findCompatibleVersion(peerName, Array.from(ranges));
      
      if (compatibleVersion) {resolved.set(peerName, compatibleVersion);
        console.log(`[DEBUG] Resolved peer dependency ${peerName} to ${compatibleVersion}`);
      } else {
        console.warn(`[WARNING] Could not resolve peer dependency ${peerName} for ranges: ${Array.from(ranges).join(', ')}`);
      }
    }
    
    return Object.fromEntries(resolved);
  }

  // Find a version that satisfies all given ranges
  async findCompatibleVersion(packageName, ranges) {
    try {
      // Get package metadata
      const metadata = await this.fetchPackageMetadata(packageName);
      const versions = Object.keys(metadata.versions).sort(semver.compare);
      
      // Find the highest version that satisfies all ranges
      for (let i = versions.length - 1; i >= 0; i--) {const version = versions[i];
        const satisfiesAll = ranges.every(range => semver.satisfies(version, range));
        
        if (satisfiesAll) {return version;
        }
      }
      
      // If no version satisfies all ranges, try to find the most compatible
      const compatibleVersions = versions.filter(version => 
        ranges.some(range => semver.satisfies(version, range))
      );
      
      if (compatibleVersions.length > 0) {// Return the highest compatible version
        return compatibleVersions[compatibleVersions.length - 1];
      }
      
      return null;
    } catch (err) {
      console.warn(`[WARNING] Could not fetch metadata for ${packageName}: ${err.message}`);
      return null;
    }
  }

  // Fetch package metadata with caching
  async fetchPackageMetadata(packageName) {
    const cachePath = path.join(CACHE_DIR, `metadata-${packageName.replace('/', '_')}.json`);
    
    try {
      // Try cache first
      const cached = await fs.readFile(cachePath, 'utf-8');
      return JSON.parse(cached);
    } catch {
      // Fetch from registry
      const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
      const { data } = await axios.get(url);
      
      // Cache the result
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.writeFile(cachePath, JSON.stringify(data), 'utf-8');
      
      return data;
    }
  }

  // Check if peer dependencies are compatible with existing dependencies
  checkPeerCompatibility(peerDeps, existingDeps) {const incompatibilities = [];
    
    for (const [peerName, peerRange] of Object.entries(peerDeps)) {
      if (existingDeps[peerName]) {const existingVersion = existingDeps[peerName];
        if (!semver.satisfies(existingVersion, peerRange)) {
          incompatibilities.push({
            peer: peerName,
            required: peerRange,
            existing: existingVersion
          });
        }
      }
    }
    
    return incompatibilities;
  }

  // Auto-resolve peer dependencies and add them to the dependency tree
  async autoResolvePeers(warnings, existingDeps = {}) {
    const peerRequirements = this.extractPeerRequirements(warnings);
    
    if (peerRequirements.size === 0) {return existingDeps;
    }
    
    console.log(`[DEBUG] Found ${peerRequirements.size} peer dependencies to resolve`);
    
    const resolvedPeers = await this.resolvePeerDependencies(peerRequirements, existingDeps);
    
    // Check for incompatibilities
    const incompatibilities = this.checkPeerCompatibility(resolvedPeers, existingDeps);
    
    if (incompatibilities.length > 0) {console.warn('[WARNING] Peer dependency incompatibilities found:');
      for (const incompat of incompatibilities) {console.warn(`  ${incompat.peer}: requires ${incompat.required}, but ${incompat.existing} is installed`);
      }
    }
    
    // Merge existing deps with resolved peers, with resolved peers taking precedence
    const result = { ...existingDeps };
    for (const [peerName, peerVersion] of Object.entries(resolvedPeers)) {
      result[peerName] = peerVersion;
    }
    
    return result;
  }
}

module.exports = { PeerDependencyResolver }; 