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
blaze publish                # Publish the package to the npm registry
blaze version <newversion>   # Bump version, commit, and tag
blaze audit fix              # Auto-fix vulnerable dependencies
blaze --interactive          # Use interactive mode
```

### Options
- `--save-dev`      Add to devDependencies
- `--production`    Only install production dependencies
- `--symlink`       Use symlinks instead of copying (for local development)
- `--json`          Output JSON (for audit)

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

## Side-by-Side: `npm install` vs `blaze install`

| Task / Feature                | `npm` command(s)                        | `blaze` command(s)                | blaze advantage / unique feature         |
|-------------------------------|-----------------------------------------|-----------------------------------|------------------------------------------|
| Install all dependencies      | `npm install`                           | `blaze install`                   | 🚀 Much faster, pruned lockfile, global cache |
| Add a dependency              | `npm install lodash`                    | `blaze install lodash`            | Lockfile always pruned, faster           |
| Remove a dependency           | `npm uninstall lodash`                  | `blaze uninstall lodash`          | Lockfile auto-pruned, cleaner            |
| Update a dependency           | `npm update lodash`                     | `blaze update lodash`             | Prunes lockfile, faster                  |
| List installed packages       | `npm list`                              | `blaze list`                      | Modern, readable output                  |
| Audit for vulnerabilities     | `npm audit`                             | `blaze audit`                     | Fast, clear output, built-in             |
| Clean node_modules & cache    | `rm -rf node_modules`<br>`npm cache clean --force` | `blaze clean`            | One command, also prunes lockfile        |
| Show outdated packages        | `npm outdated`                          | `blaze outdated`                  |                                          |
| Show package info             | `npm info lodash`                       | `blaze info lodash`               |                                          |
| Publish a package             | `npm publish`                           | `blaze publish`                   |                                          |
| Bump version                  | `npm version patch`                     | `blaze version patch`             |                                          |
| Fix vulnerabilities           | `npm audit fix`                         | `blaze audit fix`                 |                                          |
| Interactive mode              | *(n/a)*                                 | `blaze --interactive`             | Guided, menu-driven UX                   |
| Local/link dependencies       | `npm install ../my-local-pkg`           | `blaze install ../my-local-pkg`   | Symlink/copy fallback, robust            |
| Plugin system                 | *(n/a)*                                 | Plugins in `plugins/` dir         | Extendable with hooks                    |
| Lockfile pruning              | Manual, not automatic                   | Automatic after uninstall/update  | No stale dependencies                    |
| Global cache/store            | No                                      | Yes                               | Dedupes across projects, faster installs |
| Modern UX                     | Minimal feedback                        | Progress bars, color, clear errors| Beautiful CLI, actionable errors         |
| .blazerc config               | *(n/a)*                                 | `.blazerc` file                   | Project-level defaults                   |
| .npmrc support                | Yes                                     | Yes                               | Per-scope registry/auth, parity          |
| Workspaces/monorepo           | Supported, but slower                   | Native, fast, simple              | Optimized for monorepos                  |
| Peer/optional deps            | Sometimes cryptic/missing warnings      | Clear, robust handling            |                                          |
| Lifecycle scripts             | Supported                               | Supported                         | Full parity                             |
| Error handling                | Sometimes cryptic                       | Clear, actionable                  |                                          |
| Legacy baggage                | Yes                                     | No                                | Modern, focused codebase                 |

---

**Why choose blaze?**  
- 🚀 **Much faster installs** (parallel, global cache, deduplication)
- 🧹 **Cleaner lockfile** (auto-pruned, no stale deps)
- 🧩 **Extensible** (plugin system, interactive mode)
- 🎨 **Modern UX** (progress bars, color, clear errors)
- 🛡️ **Better defaults** (pruning, deduplication, error handling)
- 🏗️ **Workspaces/monorepo optimized** (fast, simple)
- 🔒 **Audit/security built-in** (fast, clear output)
- ⚙️ **Config file support** (`.blazerc`, `.npmrc` parity)
- 🧑‍💻 **No legacy code paths** (focused, modern codebase)
- 🛠️ **Robust local/link dependency support** (symlink/copy fallback)
- 📦 **Automatic lockfile pruning** after uninstall/update
- 🧩 **Plugin system** for custom workflows and automation
- 🧑‍🎨 **Beautiful CLI** with actionable errors and progress bars 