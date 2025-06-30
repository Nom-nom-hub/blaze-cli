const fs = require('fs/promises');
const path = require('path');
const semver = require('semver');

class MigrationTools {
  constructor() {this.supportedFormats = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
  }

  async detectLockfiles() {
    const files = await fs.readdir(process.cwd());
    const found = [];
    
    for (const file of files) {if (this.supportedFormats.includes(file)) {
        found.push(file);
      }
    }
    
    return found;
  }

  async migrateFromNpm() {
    try {
      const lockPath = path.join(process.cwd(), 'package-lock.json');
      const lockData = JSON.parse(await fs.readFile(lockPath, 'utf-8'));
      
      const blazeLock = {};
      
      // Convert npm lockfile format to blaze format
      if (lockData.dependencies) {this.convertNpmDependencies(lockData.dependencies, blazeLock);
      }
      
      // Write blaze lockfile
      const blazePath = path.join(process.cwd(), 'blaze-lock.json');
      await fs.writeFile(blazePath, JSON.stringify(blazeLock, null, 2), 'utf-8');
      
      console.log('✅ Successfully migrated from package-lock.json to blaze-lock.json');
      return { success: true, converted: Object.keys(blazeLock).length };
      
    } catch (error) {
      console.error('❌ Failed to migrate from npm:', error.message);
      return { success: false, error: error.message };
    }
  }

  convertNpmDependencies(npmDeps, blazeLock, parent = null) {for (const [name, info] of Object.entries(npmDeps)) {
      if (info.version) {blazeLock[name] = {
          version: info.version,
          dependencies: {},
          parent: parent
        };
        
        // Convert dependencies
        if (info.dependencies) {this.convertNpmDependencies(info.dependencies, blazeLock[name].dependencies, name);
        }
        
        // Convert optional dependencies
        if (info.optionalDependencies) {blazeLock[name].optionalDependencies = {};
          this.convertNpmDependencies(info.optionalDependencies, blazeLock[name].optionalDependencies, name);
        }
        
        // Convert peer dependencies
        if (info.peerDependencies) {blazeLock[name].peerDependencies = info.peerDependencies;
        }
      }
    }
  }

  async migrateFromYarn() {
    try {
      const lockPath = path.join(process.cwd(), 'yarn.lock');
      const lockContent = await fs.readFile(lockPath, 'utf-8');
      
      const blazeLock = {};
      const lines = lockContent.split('\n');
      let currentPackage = null;
      
      for (const line of lines) {const trimmed = line.trim();
        
        // Package header line
        if (trimmed.includes('@') && !trimmed.startsWith(' ') && !trimmed.startsWith('\t')) {
          const match = trimmed.match(/^"?([^@]+)@([^"]+)"?/);
          if (match) {currentPackage = match[1];
            const version = match[2].replace(/"/g, '');
            blazeLock[currentPackage] = {
              version: version,
              dependencies: {},
              parent: null
            };
          }
        }
        
        // Dependencies section
        if (trimmed.startsWith('dependencies:') && currentPackage) {
          let i = lines.indexOf(line) + 1;
          while (i < lines.length && (lines[i].startsWith('  ') || lines[i].startsWith('\t'))) {
            const depLine = lines[i].trim();
            if (depLine.includes(' ')) {
              const [depName, depVersion] = depLine.split(' ');
              blazeLock[currentPackage].dependencies[depName] = depVersion;
            }
            i++;
          }
        }
      }
      
      // Write blaze lockfile
      const blazePath = path.join(process.cwd(), 'blaze-lock.json');
      await fs.writeFile(blazePath, JSON.stringify(blazeLock, null, 2), 'utf-8');
      
      console.log('✅ Successfully migrated from yarn.lock to blaze-lock.json');
      return { success: true, converted: Object.keys(blazeLock).length };
      
    } catch (error) {
      console.error('❌ Failed to migrate from yarn:', error.message);
      return { success: false, error: error.message };
    }
  }

  async migrateFromPnpm() {
    try {
      const lockPath = path.join(process.cwd(), 'pnpm-lock.yaml');
      const lockContent = await fs.readFile(lockPath, 'utf-8');
      
      const blazeLock = {};
      const lines = lockContent.split('\n');
      
      for (const line of lines) {const trimmed = line.trim();
        
        // Package entry
        if (trimmed.includes('@') && !trimmed.startsWith(' ') && !trimmed.startsWith('\t')) {
          const match = trimmed.match(/^"?([^@]+)@([^"]+)"?/);
          if (match) {const name = match[1];
            const version = match[2].replace(/"/g, '');
            blazeLock[name] = {
              version: version,
              dependencies: {},
              parent: null
            };
          }
        }
      }
      
      // Write blaze lockfile
      const blazePath = path.join(process.cwd(), 'blaze-lock.json');
      await fs.writeFile(blazePath, JSON.stringify(blazeLock, null, 2), 'utf-8');
      
      console.log('✅ Successfully migrated from pnpm-lock.yaml to blaze-lock.json');
      return { success: true, converted: Object.keys(blazeLock).length };
      
    } catch (error) {
      console.error('❌ Failed to migrate from pnpm:', error.message);
      return { success: false, error: error.message };
    }
  }

  async validatePackageJson() {
    try {
      const pkgPath = path.join(process.cwd(), 'package.json');
      const pkgContent = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);
      
      const issues = [];
      
      // Check for required fields
      if (!pkg.name) issues.push('Missing "name" field');
      if (!pkg.version) issues.push('Missing "version" field');
      
      // Validate version format
      if (pkg.version && !semver.valid(pkg.version)) {
        issues.push(`Invalid version format: ${pkg.version}`);
      }
      
      // Check for common issues
      if (pkg.dependencies) {for (const [name, version] of Object.entries(pkg.dependencies)) {
          if (!semver.validRange(version)) {
            issues.push(`Invalid dependency version for ${name}: ${version}`);
          }
        }
      }
      
      if (pkg.devDependencies) {for (const [name, version] of Object.entries(pkg.devDependencies)) {
          if (!semver.validRange(version)) {
            issues.push(`Invalid devDependency version for ${name}: ${version}`);
          }
        }
      }
      
      // Check for workspace configuration
      if (pkg.workspaces && !Array.isArray(pkg.workspaces)) {
        issues.push('"workspaces" should be an array');
      }
      
      return {
        valid: issues.length === 0,
        issues: issues,
        suggestions: this.generateSuggestions(pkg, issues)
      };
      
    } catch (error) {
      return {
        valid: false,
        issues: [`Failed to parse package.json: ${error.message}`],
        suggestions: ['Check that package.json is valid JSON']
      };
    }
  }

  generateSuggestions(pkg, issues) {const suggestions = [];
    
    if (issues.includes('Missing "name" field')) {
      suggestions.push('Add a "name" field with a valid package name (lowercase, no spaces)');
    }
    
    if (issues.includes('Missing "version" field')) {
      suggestions.push('Add a "version" field (e.g., "1.0.0")');
    }
    
    if (issues.some(i => i.includes('Invalid version format'))) {
      suggestions.push('Use semantic versioning format (e.g., "1.0.0", "2.1.3")');
    }
    
    if (issues.some(i => i.includes('Invalid dependency version'))) {
      suggestions.push('Use valid semver ranges (e.g., "^1.0.0", "~2.1.0", ">=3.0.0")');
    }
    
    return suggestions;
  }

  async autoMigrate() {
    const lockfiles = await this.detectLockfiles();
    
    if (lockfiles.length === 0) {console.log('No lockfiles found to migrate');
      return { success: false, reason: 'no_lockfiles' };
    }
    
    console.log(`Found lockfiles: ${lockfiles.join(', ')}`);
    
    // Migrate from the first found lockfile
    const lockfile = lockfiles[0];
    
    if (lockfile === 'package-lock.json') {return await this.migrateFromNpm();
    } else if (lockfile === 'yarn.lock') {
      return await this.migrateFromYarn();
    } else if (lockfile === 'pnpm-lock.yaml') {
      return await this.migrateFromPnpm();
    }
    
    return { success: false, reason: 'unsupported_format' };
  }
}

module.exports = MigrationTools; 