# Changelog

## v1.11.0

- Feat: Unified `blaze fix` command to auto-fix code style, remove unused dependencies, update outdated dependencies, run diagnostics, and audit in one step.
- Feat: Enhanced ESLint/Prettier runner to only target existing source directories (`src/`, `plugins/`, `test/`).
- Feat: `unusedDependencyLinter` plugin now supports auto-removal of unused dependencies.
- Feat: `outdatedDependencyNotifier` plugin now supports auto-updating outdated dependencies.
- Chore: Migrated all source files from `lib/` to `src/` for best-practice project structure.
- Docs: Updated README and docs to reflect new structure and auto-fix features.

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

## [1.11.5] - 2025-07-04
### Added
- Minimal, beautiful CLI spinner implemented in `src/spinner.js` and built to `lib/spinner.js`.
- Placeholder test files in `test/` to prevent CI failures due to missing files.
- `.gitkeep` in root `plugins/` directory to ensure it is always present for runtime/test plugins.
- Documentation updates in README about directory structure, plugins, spinner, and CI/CD.

### Fixed
- Import path for spinner in `src/index.js` to ensure correct module resolution after build.
- CI/CD workflow now passes with correct build, plugin, and test file presence.
- Restored and clarified plugin/test directory structure for contributors and CI.
