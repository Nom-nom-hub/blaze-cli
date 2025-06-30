# Changelog

## v1.10.1 - Package Metadata Improvements 📦
- 📦 **Enhancement**: Added repository URL, homepage, and bugs links to package.json
- 🔍 **Enhancement**: Added relevant keywords for better npm discoverability
- 📝 **Enhancement**: Improved package description to be more descriptive
- 🏷️ **Fix**: npm package now properly links to GitHub repository

### Technical Details:
- **Repository**: Added proper git repository URL to package.json
- **Homepage**: Links to GitHub README for documentation
- **Bugs**: Links to GitHub issues for bug reports
- **Keywords**: Added relevant search terms for better discoverability

## v1.10.0 - CLI Async Fix 🔧
- 🔧 **Fix**: CLI help output now displays correctly - fixed async/await issue in main entrypoint
- 🐛 **Fix**: Resolved issue where `blaze --help` and `blaze install --help` would not show help text
- 🔄 **Enhancement**: Improved CLI reliability and error handling for all command outputs
- 🧪 **Test**: Verified help output works correctly for all commands

### Technical Details:
- **CLI Entrypoint**: Fixed `bin/blaze-install.js` to properly await the async main function
- **Help Display**: All help text now renders correctly without hanging or errors
- **Command Reliability**: Enhanced error handling for better user experience

## v1.9.0 - Technical Improvements 🔧
- 🔧 **Fix**: Progress bars now work without string-width dependency issues - implemented robust progress indicator
- 🌐 **Fix**: Registry hardcoding resolved - all functions now use the registry service with proper fallback support
- 📦 **Enhancement**: Improved lockfile format with metadata, integrity checks, and better structure
- 🔍 **Enhancement**: Intelligent dependency deduplication - resolves version conflicts automatically
- 🛠️ **Enhancement**: Better dependency resolution with proper version selection and conflict detection
- 📊 **Enhancement**: Enhanced package metadata tracking with platform and architecture info
- 🔄 **Fix**: Backward compatibility maintained for existing lockfiles
- 🧪 **Test**: Added comprehensive testing for all improvements

### Technical Improvements:
- **Progress Bars**: Simple, robust progress indicator that doesn't rely on external dependencies
- **Registry Service**: Centralized registry handling with automatic fallback between multiple registries
- **Lockfile v2.0**: New format with integrity checks, metadata, and better structure
- **Dependency Deduplication**: Intelligent version conflict resolution within projects
- **Enhanced Resolution**: Better version selection and dependency tree analysis

## v1.8.0 - Enterprise Edition 🚀
- 🌐 **Feat**: Registry mirroring with fallback support - automatically tries multiple registries if one fails
- 🔐 **Feat**: Package signing verification with GPG/PGP support and trusted key management
- 🔄 **Feat**: Migration tools for npm/yarn/pnpm lockfiles to blaze-lock.json
- 📊 **Feat**: Performance profiling and analysis with detailed metrics and recommendations
- ✅ **Feat**: Package.json validation with intelligent suggestions for common issues
- 🏢 **Feat**: Enterprise commands for registry status, signing keys, and migration
- 🔧 **Enhancement**: Enhanced error handling and diagnostics for enterprise environments
- 📚 **Docs**: Comprehensive documentation for all enterprise features
- 🌍 **Feat**: Cross-platform consistency - Platform-aware dependency resolution ensures lockfiles are consistent across different OS's and architectures
- 🔍 **Feat**: Automatic platform detection and filtering of incompatible optional dependencies
- 🐛 **Fix**: Platform-specific packages (like `@oxlint/win32-x64`) are now properly filtered based on current platform
- 📚 **Docs**: Added comprehensive documentation for cross-platform consistency feature
- 🔧 **Debug**: Added platform information to debug output with `--debug` flag

### Enterprise Commands Added:
- `blaze migrate` - Migrate from npm/yarn/pnpm lockfiles
- `blaze validate` - Validate package.json for issues
- `blaze profile <start|stop|save>` - Performance profiling and analysis
- `blaze registry status` - Show registry mirror status
- `blaze signing <keys|add-key>` - Manage package signing keys

### Environment Variables:
- `BLAZE_REGISTRIES` - Comma-separated list of registry mirrors
- `BLAZE_VERIFY_SIGNATURES` - Enable/disable signature verification
- `BLAZE_TRUSTED_KEYS` - Comma-separated list of trusted GPG keys

## v1.7.0
- 🌍 **Feat**: Cross-platform consistency - Platform-aware dependency resolution ensures lockfiles are consistent across different OS's and architectures
- 🔍 **Feat**: Automatic platform detection and filtering of incompatible optional dependencies
- 🐛 **Fix**: Platform-specific packages (like `@oxlint/win32-x64`) are now properly filtered based on current platform
- 📚 **Docs**: Added comprehensive documentation for cross-platform consistency feature
- 🔧 **Debug**: Added platform information to debug output with `--debug` flag

## v1.6.1
- 📚 **Docs**: Updated npm package with comprehensive README documentation for new CLI output features
- 📦 **Chore**: Patch release to sync documentation between GitHub and npm

## v1.6.0
- ✨ **Feat**: Enhanced CLI output with beautiful box-drawing characters and detailed installation summaries
- 🎨 **Feat**: Theme support with `--dark` (default) and `--light` color schemes
- 🔤 **Feat**: ASCII mode support with `--ascii` or `--no-unicode` flags for environments without unicode support
- 📊 **Feat**: Dynamic width calculation and proper text alignment in CLI output
- 🎯 **Feat**: Modular CLI components for easy customization and extension
- 🔧 **Fix**: Improved lockfile sync detection - automatically updates lockfile when package.json changes
- 🐛 **Fix**: Resolved progress bar compatibility issues with string-width dependencies
- 📚 **Docs**: Updated README with comprehensive CLI output documentation and examples

## v1.5.0
- Feat: Offline mode (`--offline`) for fully local, cache-only installs.
- Feat: `blaze prefetch` command to prefetch/cache all dependencies and tarballs for offline use.
- Feat: Self-healing and diagnostics improvements: `blaze doctor --fix` auto-repairs common issues (missing node_modules, lockfile, broken symlinks).
- Feat: Enhanced peer dependency handling with clear warnings and auto-install prompt for missing peers.
- Docs: Updated README with all new features, usage, and examples.
- Fix: CLI now robustly handles all commands and flags, including new features.

## v1.4.1
- Chore: Removed `packages` folder and sample workspaces for a cleaner release.

## v1.4.0
- Feat: `blaze graph` command for visual dependency graphs (Mermaid.js output).
- Feat: `blaze upgrade` for interactive upgrades of outdated dependencies.
- Feat: Monorepo/workspaces support with `--workspaces` flag for running scripts across all workspaces.
- Feat: `blaze doctor` for diagnostics and interactive fixes (lockfile, cache, etc.).
- Feat: Plugin system now supports before/after hooks for all major commands (install, uninstall, update, audit, clean).
- Perf: Parallelized network requests for package metadata and added metadata caching for faster installs.
- Fix: Various bug fixes and stability improvements.

## v1.3.1
- Chore: Version bump for patch release.

## v1.3.0
- Feat: Enhanced plugin system with a comprehensive set of lifecycle hooks (`before`/`after` for `uninstall`, `update`, `audit`, and `clean`).
- Fix: Resolved multiple dependency and scoping issues to improve stability.

## v1.0.0
- Initial release of blaze-install
- Full dependency tree resolution and lockfile support
- Parallelized downloads and extraction, with caching and deduplication
- CLI: `blaze install`, `blaze install <package>`, global install via npm link
- Version/range syntax, devDependencies (`--save-dev`), production installs (`--production`)
- Workspace/monorepo support via `workspaces` in package.json
- Uninstall (`blaze uninstall <package>`) and update (`blaze update <package>`) commands
- Audit/security checks (`blaze audit`) using npm audit API
- Peer and optional dependency support, with clear warnings
- Lifecycle script support (preinstall, install, postinstall)
- Robust error handling and reporting
- Beautiful, colored CLI output with progress bars
- Lockfile pruning after uninstall
- Global cache/store in user's home directory 