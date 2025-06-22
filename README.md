<p align="center">
  <img src="https://raw.githubusercontent.com/TrialLord/Blazed-install/main/logo.svg" alt="blaze-install logo" width="160"/>
</p>

# blaze-install

A fast, modern alternative to `npm install` for Node.js projects.

## Features
- 🚀 **Blazing fast**: Parallel downloads, extraction, and a global cache/store for deduplication.
- 📦 **Full dependency tree resolution** and lockfile support.
- 🏗️ **Workspaces/monorepo support** via the `workspaces` field in package.json.
- 🎨 **Beautiful CLI**: Colored output and progress bars (using chalk and cli-progress).
- 🔒 **Audit/security checks**: Built-in `blaze audit` using the npm audit API.
- 🧩 **Peer and optional dependency support** with clear warnings.
- 🔄 **Lifecycle scripts**: preinstall, install, postinstall.
- 🛠️ **Uninstall and update**: `blaze uninstall <package>`, `blaze update <package>`.
- 🧹 **Lockfile pruning**: Only keeps what's needed, no stale dependencies.
- 💥 **Robust error handling** and reporting.
- 🏗️ **Global cache/store** in your home directory for cross-project speed.

## Installation

```
npm install -g blaze-install
```

Or use directly in your project:

```
npm install blaze-install --save-dev
```

## Usage

Run in your project directory:

```
blaze install                # Install all dependencies from package.json
blaze install <package>      # Add and install a package
blaze uninstall <package>    # Remove a package and prune lockfile
blaze update <package>       # Update a package to the latest version
blaze audit                  # Run a security audit
```

### Options
- `--save-dev`      Add to devDependencies
- `--production`    Only install production dependencies
- `--symlink`       Use symlinks instead of copying (for local development)

### Workspaces/Monorepo
If your `package.json` includes a `workspaces` field, blaze-install will automatically resolve and install all workspace dependencies.

## How is blaze-install different from npm?
- **Much faster**: Parallelized, with a global cache and deduplication.
- **Cleaner lockfile**: Only what you need, always pruned.
- **Better UX**: Progress bars, colored output, clear warnings.
- **Modern workflows**: Workspaces, peer/optional dependencies, lifecycle scripts.
- **No legacy cruft**: Focused on the 90% use case for modern Node.js projects.

## Project Philosophy
- **Speed and simplicity first**
- **No legacy baggage**
- **Clear, actionable feedback**
- **Easy to contribute and extend**

## Contributing
Pull requests and issues are welcome! Please open an issue for bugs, feature requests, or questions.

## License
MIT 