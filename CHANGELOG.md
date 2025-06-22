# Changelog

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