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
blaze audit --json           # Run audit and output JSON
blaze list                   # List installed dependencies
blaze clean                  # Remove node_modules and cache
blaze outdated               # Show outdated dependencies
blaze info <package>         # Show info about a package
blaze --interactive          # Use interactive mode
```

### Options
- `--save-dev`      Add to devDependencies
- `--production`    Only install production dependencies
- `--symlink`       Use symlinks instead of copying (for local development)
- `--json`          Output JSON (for audit)

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
  }
};
```
Supported hooks: `onCommand`, `beforeInstall`, `afterInstall` (more coming soon!).

### Workspaces/Monorepo
If your `package.json` includes a `workspaces` field, blaze-install will automatically resolve and install all workspace dependencies.

## .blazerc Config File

You can create a `.blazerc` file in your project root to set default options for blaze-install. CLI flags always override config file options.

Example `.blazerc`:
```json
{
  "symlink": true,
  "production": false,
  "saveDev": false
}
```

Supported options:
- `symlink`: Use symlinks instead of copying (default: false)
- `production`: Only install production dependencies (default: false)
- `saveDev`: Add new packages to devDependencies by default (default: false)

## Why Choose blaze-install?

| Feature                | blaze-install         | npm install         |
|------------------------|----------------------|---------------------|
| **Speed**              | 🚀 Blazing fast: parallel downloads, global cache, deduplication | Slower, sequential, no global cache |
| **Lockfile**           | Always pruned, only what you need | Can become bloated, stale deps remain |
| **UX**                 | Beautiful CLI, progress bars, colored output | Basic CLI, minimal feedback |
| **Workspaces**         | Native support, fast monorepo installs | Supported, but slower and more complex |
| **Peer/Optional Deps** | Clear warnings, robust handling | Sometimes cryptic or missing warnings |
| **Audit**              | Built-in, fast, npm audit API | Built-in |
| **Lifecycle Scripts**  | Full support (preinstall, install, postinstall) | Supported |
| **Global Store**       | Yes, dedupes across projects | No |
| **Error Handling**     | Clear, actionable, modern | Sometimes cryptic |
| **Modern Focus**       | No legacy cruft, focused on 90% use case | Lots of legacy baggage |

### Key Advantages
- **Much faster installs** thanks to parallelization and a global cache.
- **Cleaner lockfile**: No stale or unused dependencies.
- **Better developer experience**: Progress bars, color, and clear output.
- **Automatic lockfile pruning** after uninstall/update.
- **Modern workflows**: Workspaces, peer/optional deps, lifecycle scripts.
- **No legacy code paths**: Focused on what modern Node.js projects need.

## How is blaze-install different from npm?

blaze-install is designed for speed, simplicity, and a better developer experience. It avoids the legacy complexity of npm, making it ideal for modern projects and monorepos. If you want blazing fast installs, a clean lockfile, and a beautiful CLI, blaze-install is for you.

## Project Philosophy
- **Speed and simplicity first**
- **No legacy baggage**
- **Clear, actionable feedback**
- **Easy to contribute and extend**

## Contributing
Pull requests and issues are welcome! Please open an issue for bugs, feature requests, or questions.

## License
MIT 