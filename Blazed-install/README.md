<p align="center">
  <img src="blaze-light.png" alt="blaze-install logo" width="260"/>
</p>

<p align="center">
  <!-- License (static MIT badge for clarity) -->
  <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="license">
  <!-- GitHub Build Status -->
  <a href="https://github.com/blazeinstall/Blaze/actions"><img src="https://img.shields.io/github/actions/workflow/status/blazeinstall/Blaze/ci.yml?branch=main&style=flat-square" alt="Build Status"></a>
  <!-- GitHub Issues -->
  <a href="https://github.com/blazeinstall/Blaze/issues"><img src="https://img.shields.io/github/issues/blazeinstall/Blaze?style=flat-square" alt="GitHub issues"></a>
  <!-- GitHub PRs -->
  <a href="https://github.com/blazeinstall/Blaze/pulls"><img src="https://img.shields.io/github/issues-pr/blazeinstall/Blaze?style=flat-square" alt="GitHub pull requests"></a>
  <!-- GitHub Last Commit -->
  <a href="https://github.com/blazeinstall/Blaze/commits/main"><img src="https://img.shields.io/github/last-commit/blazeinstall/Blaze?style=flat-square" alt="GitHub last commit"></a>
  <!-- Node version and code style -->
  <img src="https://img.shields.io/badge/node-%3E=18.0.0-brightgreen?style=flat-square" alt="node version">
  <img src="https://img.shields.io/badge/code_style-eslint-blue?style=flat-square" alt="ESLint">
  <!-- Development Status -->
  <img src="https://img.shields.io/badge/status-development-orange?style=flat-square" alt="development status">
</p>

# blaze-install

A blazing fast, modern package manager for JavaScript/Node.js.

## Getting Started

Clone the repository:

```sh
git clone https://github.com/blazeinstall/Blaze.git
cd blaze-install
```

## Repository

This project is now hosted on GitHub: [https://github.com/blazeinstall/Blaze](https://github.com/blazeinstall/Blaze)

## Issues

Please use the GitHub issue tracker: [https://github.com/blazeinstall/Blaze/issues](https://github.com/blazeinstall/Blaze/issues)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT

## Features
- 🚀 **Blazing fast**: Parallel downloads, extraction, and a global cache/store for deduplication.
- 📦 **Full dependency tree resolution** and lockfile support.
- 🏗️ **Workspaces/monorepo support** via the `workspaces` field in package.json.
- 🎨 **Beautiful CLI**: Colored output, progress bars, and customizable themes with box-drawing characters.
- 🔒 **Audit/security checks**: Built-in `blaze audit` using the npm audit API.
- 🧩 **Peer and optional dependency support** with clear warnings.
- 🔄 **Lifecycle scripts**: preinstall, install, postinstall.
- 🛠️ **Uninstall and update**: `blaze uninstall <package>`, `blaze update <package>`.
- 🧹 **Lockfile pruning**: Only keeps what's needed, no stale dependencies.
- 💥 **Robust error handling** and reporting.
- 🏗️ **Global cache/store** in your home directory for cross-project speed.
- 🎨 **Enhanced CLI Output**: Beautiful box-drawing summaries with themes and ASCII support.
- 🌍 **Cross-platform consistency**: Platform-aware dependency resolution ensures lockfiles are consistent across different OS's and architectures.

## Installation

```
npm install -g blaze-install
```

Or use directly in your project:

```
npm install blaze-install --save-dev
```

## Cross-Platform Consistency

blaze-install ensures **consistent lockfiles across different operating systems and architectures** by implementing platform-aware dependency resolution:

### How It Works

- **Platform Detection**: Automatically detects your current OS (`win32`, `darwin`, `linux`) and architecture (`x64`, `arm64`, `ia32`)
- **Smart Filtering**: Filters out platform-specific optional dependencies that don't match your current platform
- **Consistent Results**: Generates the same lockfile structure regardless of where it's created

### Example

When installing on **Windows x64**:
- ✅ Includes: `@oxlint/win32-x64`
- ❌ Excludes: `@oxlint/darwin-arm64`, `@oxlint/linux-x64-gnu`, etc.

When installing on **macOS ARM64**:
- ✅ Includes: `@oxlint/darwin-arm64`
- ❌ Excludes: `@oxlint/win32-x64`, `@oxlint/linux-x64-gnu`, etc.

### Benefits

- **Team Collaboration**: All developers get consistent lockfiles regardless of their OS
- **CI/CD Reliability**: Builds work the same way across different environments
- **No Platform Pollution**: Lockfiles only contain dependencies relevant to the current platform
- **Debugging**: Use `--debug` to see platform information and filtering in action

### Debug Output

```bash
blaze install --debug
```

Shows platform information:
```
[DEBUG] Platform: win32-x64 (win32-x64)
[DEBUG] Platform-aware dependency resolution enabled - filtering incompatible optional dependencies
```

## Usage

Run in your project directory:

```
blaze install                # Install all dependencies from package.json
blaze install <package>      # Add and install a package
blaze uninstall <package>    # Remove a package and prune lockfile
blaze update <package>       # Update a package to the latest version
blaze audit                  # Run a security audit
blaze audit --json           # Run audit and output JSON
blaze list                   # List installed dependencies
blaze clean                  # Remove node_modules and cache
blaze outdated               # Show outdated dependencies
blaze info <package>         # Show info about a package
blaze publish                # Publish the package to the npm registry
blaze version <newversion>   # Bump version, commit, and tag
blaze audit fix              # Auto-fix vulnerable dependencies
blaze --interactive          # Use interactive mode
blaze prefetch               # Prefetch/cache all dependencies for offline use
```

## Enterprise Features 🏢

blaze-install includes powerful enterprise-grade features for teams and organizations:

### Registry Mirroring & Fallback
Automatically try multiple registries if one fails, ensuring high availability:

```bash
# Set multiple registries via environment variable
export BLAZE_REGISTRIES="https://registry.npmjs.org/,https://your-private-registry.com/"

# Check registry status
blaze registry status
```

**Features:**
- Automatic fallback between registries
- Health monitoring and status reporting
- Support for private registries and mirrors
- Configurable via environment variables or `.npmrc`

### Package Signing Verification
Verify package integrity and authenticity with GPG/PGP signatures:

```bash
# Enable signature verification
export BLAZE_VERIFY_SIGNATURES=true

# Manage trusted keys
blaze signing keys
blaze signing add-key <key-id>

# Or set trusted keys via environment
export BLAZE_TRUSTED_KEYS="key1,key2,key3"
```

**Features:**
- GPG/PGP signature verification
- Trusted key management
- Hash-based fallback verification
- Configurable verification policies

### Migration Tools
Seamlessly migrate from other package managers:

```bash
# Auto-detect and migrate from npm/yarn/pnpm
blaze migrate

# Validate package.json for issues
blaze validate
```

**Supported Formats:**
- `package-lock.json` (npm)
- `yarn.lock` (Yarn)
- `pnpm-lock.yaml` (pnpm)

**Validation Features:**
- Semantic versioning compliance
- Dependency range validation
- Workspace configuration checks
- Intelligent suggestions for fixes

### Performance Profiling
Analyze and optimize your installation performance:

```bash
# Start profiling
blaze profile start

# Run your install
blaze install

# Stop profiling and view results
blaze profile stop

# Save detailed report
blaze profile save my-report.json
```

**Metrics Tracked:**
- Installation time by phase
- Package download times
- Cache hit rates
- Network performance
- Error analysis

**Recommendations:**
- Performance bottleneck identification
- Cache optimization suggestions
- Network issue detection
- Error resolution guidance

### Beautiful CLI Output

blaze-install features a beautiful, customizable CLI output with box-drawing characters and detailed installation summaries:

```
┌────────────────────────────────────────┐
│          Blaze Install v1.6.0          │
├───────────────┬─────────────────────┤
│Package        │Dependencies         │
│Installed in   │2.35s                │
│Skipped        │111 (cached)         │
│Output Path    │./node_modules/      │
├───────────────┴─────────────────────┤
│ ✅ Success:  63    ⚠️ Skipped: 111        ⏱ 2.35s  │
└────────────────────────────────────────┘

🔧 Run with --debug for more details.
```

#### CLI Themes and Options

**Theme Support:**
- `--dark` (default): Cyan borders, green success, yellow warnings
- `--light`: Gray borders, blue success, red warnings

**Unicode/ASCII Support:**
- `--ascii` or `--no-unicode`: Use ASCII characters for environments that don't support unicode

**Examples:**
```bash
# Default dark theme with unicode
blaze install

# Light theme
blaze install --light

# ASCII mode (no unicode)
blaze install --ascii

# Light theme + ASCII
blaze install --light --ascii
```

**ASCII Output Example:**
```
+----------------------------------------+
|          Blaze Install v1.6.0          |
+---------------+---------------------+
|Package        |Dependencies         |
|Installed in   |2.35s                |
|Skipped        |111 (cached)         |
|Output Path    |./node_modules/      |
+---------------+---------------------+
| OK Success:  63    !! Skipped: 111        TIME 2.35s  |
+----------------------------------------+

TOOLS Run with --debug for more details.
```

### Options
- `--save-dev`      Add to devDependencies
- `--production`    Only install production dependencies
- `--symlink`       Use symlinks instead of copying (for local development)
- `--json`          Output JSON (for audit)
- `--offline`       **Offline mode:** Only use local cache and lockfile; no network requests. Fails if a required package or metadata is missing from the cache.
- `--fix`           (doctor) Attempt to automatically repair common issues.

### Prefetch/Cache Warming
Use `blaze prefetch` to download and cache all dependencies and their tarballs for offline use:

```sh
blaze prefetch
```
- Resolves all dependencies (including workspaces).
- Fetches and caches all required metadata and tarballs.
- Does not install anything, just prepares the cache for offline mode.
- Prints a summary of what was prefetched.

### Self-Healing & Diagnostics: `blaze doctor`
blaze-install includes a built-in diagnostics and self-healing command:

```sh
blaze doctor [--fix]
```
- Checks for missing or corrupt `node_modules`.
- Detects lockfile/package.json mismatches.
- Warns about broken symlinks.
- Provides actionable suggestions for common issues.
- With `--fix`, will attempt to automatically repair issues (recreate node_modules, regenerate lockfile, remove broken symlinks).

### Peer Dependency Handling
- After installing or adding dependencies, blaze-install will print clear warnings for missing or incompatible peer dependencies.
- If not in offline mode, you will be prompted to auto-install missing peer dependencies with a single confirmation.
- This helps keep your project healthy and avoids common peer dependency issues.

### Local Diagnostics/AI System
blaze-install uses a local, rule-based diagnostics system (no cloud/LLM dependencies) to:
- Detect and suggest fixes for common install and project errors.
- Provide context-aware CLI help and troubleshooting.
- All logic runs locally and is extensible for future rules and checks.

### .npmrc Support
blaze-install reads registry and authentication settings from both project and user `.npmrc` files, just like npm. This is used for publishing, installing, and auditing packages. You can also use the `NPM_TOKEN` environment variable for authentication.

### Interactive Mode
Run `blaze --interactive` to use a guided, menu-driven workflow for common tasks (install, uninstall, update, audit, etc.).

### Plugins
You can extend blaze-install by adding plugins to the `plugins/` directory in your project root. Each plugin is a JS file exporting hooks:

Example `plugins/examplePlugin.js`:
```js
module.exports = {
  onCommand({ command, args, context }) {
    console.log(`[plugin] Command executed: ${command} (cwd: ${context.cwd})`);
  },
  beforeInstall({ args, context }) {
    console.log('[plugin] Before install hook');
  },
  afterInstall({ args, context }) {
    console.log('[plugin] After install hook');
  },
  beforeUninstall({ args, context }) {
    console.log('[plugin] Before uninstall hook');
  },
  afterUninstall({ args, context }) {
    console.log('[plugin] After uninstall hook');
  },
  beforeUpdate({ args, context }) {
    console.log('[plugin] Before update hook');
  },
  afterUpdate({ args, context }) {
    console.log('[plugin] After update hook');
  },
  beforeAudit({ context }) {
    console.log('[plugin] Before audit hook');
  },
  afterAudit({ context }) {
    console.log('[plugin] After audit hook');
  },
  beforeClean({ context }) {
    console.log('[plugin] Before clean hook');
  },
  afterClean({ context }) {
    console.log('[plugin] After clean hook');
  },
};
```