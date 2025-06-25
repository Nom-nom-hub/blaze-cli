# Changelog

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