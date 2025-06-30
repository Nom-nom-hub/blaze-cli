const fs = require('fs/promises');
const path = require('path');
const glob = require('glob');
const semver = require('semver');

// Workspace dependency resolution with proper deduplication and conflict handling
class WorkspaceResolver {
  constructor(rootDir) {this.rootDir = rootDir;
    this.workspaces = new Map(); // workspace name -> workspace info
    this.dependencyGraph = new Map(); // package name -> Set of workspaces that depend on it
    this.versionConflicts = new Map(); // package name -> Map<version, Set<workspace>>
  }

  async discoverWorkspaces(workspacePatterns) {
    console.log('[DEBUG] Discovering workspaces with patterns:', workspacePatterns);
    
    for (const pattern of workspacePatterns) {const matches = glob.sync(pattern, { cwd: this.rootDir, absolute: true });
      for (const wsPath of matches) {const pkgPath = path.join(wsPath, 'package.json');
        try {
          const data = await fs.readFile(pkgPath, 'utf-8');
          const pkg = JSON.parse(data);
          
          if (pkg.name) {this.workspaces.set(pkg.name, {
              name: pkg.name,
              path: wsPath,
              packageJson: pkg,
              dependencies: { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
            });
            console.log(`[DEBUG] Found workspace: ${pkg.name} at ${wsPath}`);
          }
        } catch (err) {
          console.warn(`[DEBUG] Could not read package.json at ${pkgPath}: ${err.message}`);
        }
      }
    }
    
    return Array.from(this.workspaces.values());
  }

  // Build dependency graph and detect conflicts
  buildDependencyGraph() {console.log('[DEBUG] Building workspace dependency graph...');
    
    // Clear previous state
    this.dependencyGraph.clear();
    this.versionConflicts.clear();
    
    // Build dependency graph
    for (const [wsName, workspace] of this.workspaces) {for (const [depName, depVersion] of Object.entries(workspace.dependencies)) {
        // Track which workspaces depend on this package
        if (!this.dependencyGraph.has(depName)) {
          this.dependencyGraph.set(depName, new Set());
        }
        this.dependencyGraph.get(depName).add(wsName);
        
        // Track version conflicts
        if (!this.versionConflicts.has(depName)) {
          this.versionConflicts.set(depName, new Map());
        }
        const versionMap = this.versionConflicts.get(depName);
        if (!versionMap.has(depVersion)) {
          versionMap.set(depVersion, new Set());
        }
        versionMap.get(depVersion).add(wsName);
      }
    }
    
    // Report conflicts
    this.reportVersionConflicts();
  }

  reportVersionConflicts() {const conflicts = [];
    
    for (const [pkgName, versionMap] of this.versionConflicts) {if (versionMap.size > 1) {const conflictInfo = {
          package: pkgName,
          versions: Array.from(versionMap.entries()).map(([version, workspaces]) => ({
            version,
            workspaces: Array.from(workspaces)
          }))
        };
        conflicts.push(conflictInfo);
        
        console.warn(`[WARNING] Version conflict for ${pkgName}:`);
        for (const { version, workspaces } of conflictInfo.versions) {console.warn(`  ${version}: ${workspaces.join(', ')}`);
        }
      }
    }
    
    return conflicts;
  }

  // Resolve dependencies with conflict resolution
  resolveDependencies(rootDependencies = {}, rootDevDependencies = {}) {console.log('[DEBUG] Resolving workspace dependencies with conflict resolution...');
    
    const resolved = new Map(); // package name -> resolved version
    const hoisted = new Set(); // packages that should be hoisted to root
    const workspaceSpecific = new Map(); // workspace name -> Map<package, version>
    
    // Start with root dependencies
    for (const [pkgName, version] of Object.entries({ ...rootDependencies, ...rootDevDependencies })) {
      resolved.set(pkgName, version);
      hoisted.add(pkgName);
    }
    
    // Process workspace dependencies
    for (const [pkgName, versionMap] of this.versionConflicts) {if (resolved.has(pkgName)) {
        // Root already has this package, check compatibility
        const rootVersion = resolved.get(pkgName);
        const versions = Array.from(versionMap.keys());
        
        // Check if any workspace version is compatible with root
        const compatibleVersions = versions.filter(v => semver.satisfies(v, rootVersion) || semver.satisfies(rootVersion, v));
        
        if (compatibleVersions.length > 0) {// Use root version, workspaces can use it
          console.log(`[DEBUG] Using root version for ${pkgName}: ${rootVersion}`);
        } else {
          // Conflict - need to resolve
          const resolvedVersion = this.resolveVersionConflict(pkgName, versions, rootVersion);
          resolved.set(pkgName, resolvedVersion);
          hoisted.add(pkgName);
          console.log(`[DEBUG] Resolved conflict for ${pkgName}: ${resolvedVersion}`);
        }
      } else {
        // No root dependency, resolve workspace conflict
        if (versionMap.size === 1) {// Single version, use it
          const version = Array.from(versionMap.keys())[0];
          resolved.set(pkgName, version);
          hoisted.add(pkgName);
        } else {
          // Multiple versions, need to resolve
          const versions = Array.from(versionMap.keys());
          const resolvedVersion = this.resolveVersionConflict(pkgName, versions);
          resolved.set(pkgName, resolvedVersion);
          hoisted.add(pkgName);
          console.log(`[DEBUG] Resolved workspace conflict for ${pkgName}: ${resolvedVersion}`);
        }
      }
    }
    
    // Handle workspace-specific dependencies (not hoisted)
    for (const [wsName, workspace] of this.workspaces) {const wsSpecific = new Map();
      
      for (const [pkgName, version] of Object.entries(workspace.dependencies)) {
        if (!hoisted.has(pkgName)) {
          // This package is workspace-specific
          wsSpecific.set(pkgName, version);
        }
      }
      
      if (wsSpecific.size > 0) {workspaceSpecific.set(wsName, wsSpecific);
      }
    }
    
    return {
      hoisted: Object.fromEntries(resolved),
      workspaceSpecific: Object.fromEntries(
        Array.from(workspaceSpecific.entries()).map(([wsName, deps]) => [
          wsName,
          Object.fromEntries(deps)
        ])
      ),
      conflicts: this.reportVersionConflicts()
    };
  }

  // Simple version conflict resolution strategy
  resolveVersionConflict(pkgName, versions, rootVersion = null) {// Strategy: prefer the highest version that satisfies all constraints
    // This is a simplified approach - real package managers have more sophisticated strategies
    
    if (rootVersion) {// If there's a root version, try to find a compatible higher version
      const compatibleVersions = versions.filter(v => semver.satisfies(v, rootVersion) || semver.satisfies(rootVersion, v));
      if (compatibleVersions.length > 0) {return semver.maxSatisfying(compatibleVersions, '*') || compatibleVersions[0];
      }
    }
    
    // Find the highest version that satisfies all constraints
    const sortedVersions = versions.sort(semver.compare);
    const highestVersion = sortedVersions[sortedVersions.length - 1];
    
    // Check if highest version satisfies all constraints
    const allCompatible = versions.every(v => semver.satisfies(highestVersion, v) || semver.satisfies(v, highestVersion));
    
    if (allCompatible) {return highestVersion;
    }
    
    // Fallback: use the highest version and warn
    console.warn(`[WARNING] Could not find compatible version for ${pkgName}. Using ${highestVersion} but some workspaces may have issues.`);
    return highestVersion;
  }

  // Get workspace paths for installation
  getWorkspacePaths() {return Array.from(this.workspaces.values()).map(ws => ws.path);
  }

  // Get all dependencies that need to be installed
  getAllDependencies(rootDependencies = {}, rootDevDependencies = {}) {const resolved = this.resolveDependencies(rootDependencies, rootDevDependencies);
    
    // Combine hoisted dependencies with workspace-specific ones
    const allDeps = { ...resolved.hoisted };
    
    for (const [wsName, wsDeps] of Object.entries(resolved.workspaceSpecific)) {
      Object.assign(allDeps, wsDeps);
    }
    
    return allDeps;
  }
}

module.exports = { WorkspaceResolver }; 