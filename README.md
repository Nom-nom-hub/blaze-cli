<p align="center">
  <img src="blaze-dark.png" alt="blaze-install logo" width="260"/>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/blaze-install"><img src="https://img.shields.io/npm/v/blaze-install.svg?style=flat-square" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/blaze-install"><img src="https://img.shields.io/npm/dw/blaze-install?style=flat-square" alt="npm downloads"></a>
  <a href="https://github.com/Nom-nom-hub/blaze-cli/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/blaze-install?style=flat-square" alt="license"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/node/v/blaze-install?style=flat-square" alt="node version"></a>
  <a href="https://github.com/Nom-nom-hub/blaze-cli/actions/workflows/ci.yml"><img src="https://github.com/Nom-nom-hub/blaze-cli/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
  <a href="https://github.com/Nom-nom-hub/blaze-cli/issues"><img src="https://img.shields.io/github/issues/Nom-nom-hub/blaze-cli?style=flat-square" alt="GitHub issues"></a>
  <a href="https://github.com/Nom-nom-hub/blaze-cli/pulls"><img src="https://img.shields.io/github/issues-pr/Nom-nom-hub/blaze-cli?style=flat-square" alt="GitHub pull requests"></a>
  <a href="https://github.com/Nom-nom-hub/blaze-cli/stargazers"><img src="https://img.shields.io/github/stars/Nom-nom-hub/blaze-cli?style=flat-square" alt="GitHub stars"></a>
  <a href="https://github.com/Nom-nom-hub/blaze-cli/commits/main"><img src="https://img.shields.io/github/last-commit/Nom-nom-hub/blaze-cli?style=flat-square" alt="GitHub last commit"></a>
  <img src="https://img.shields.io/badge/Open%20Source-MIT-brightgreen?style=flat-square" alt="Open Source"/>
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

## 🔄 Auto-Install with `blaze watch`

`blaze watch` is a powerful developer tool that keeps your dependencies in sync with your code as you work.

- **Automatic install:** Scans your project for `require()` and `import` statements and auto-installs any missing npm packages.
- **Batch install:** Installs all missing packages in a single command for speed and convenience.
- **Node.js core module filtering:** Never tries to install built-in Node.js modules (like `fs`, `path`, `os`, etc.)—only real npm packages are installed.
- **Works before and after:** Detects missing packages both before you start the watcher (on startup) and as you add new imports/requires while coding.

### Usage

```sh
blaze watch
```

- Start the watcher in your project root.
- Add any `require('some-pkg')` or `import ... from 'some-pkg'` to your code.
- `blaze` will detect and install missing npm packages automatically.
- No more manual installs or missing dependency errors!

## Installation

```
npm install -g blaze-install
```

Or use directly in your project:

```
npm install blaze-install --save-dev
```

## Installing from GitHub or Tarball URLs

Blaze supports installing packages directly from GitHub or tarball URLs:

- GitHub repo (default branch):
  ```sh
  blaze install user/repo
  ```
- GitHub repo (specific branch, tag, or commit):
  ```sh
  blaze install user/repo#branch-or-tag
  blaze install github:user/repo#commit-sha
  ```
- Tarball URL:
  ```sh
  blaze install https://example.com/some-package.tgz
  ```

These packages will be downloaded, extracted, and added to your dependencies and lockfile for reproducible installs.

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

### Options

- `--save-dev` Add to devDependencies
- `--production` Only install production dependencies
- `--symlink` Use symlinks instead of copying (for local development)
- `--json` Output JSON (for audit)
- `--offline` **Offline mode:** Only use local cache and lockfile; no network requests. Fails if a required package or metadata is missing from the cache.
- `--fix` (doctor) Attempt to automatically repair common issues.

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
    console.log("[plugin] Before install hook");
  },
  afterInstall({ args, context }) {
    console.log("[plugin] After install hook");
  },
  beforeUninstall({ args, context }) {
    console.log("[plugin] Before uninstall hook");
  },
  afterUninstall({ args, context }) {
    console.log("[plugin] After uninstall hook");
  },
  beforeUpdate({ args, context }) {
    console.log("[plugin] Before update hook");
  },
  afterUpdate({ args, context }) {
    console.log("[plugin] After update hook");
  },
  beforeAudit({ context }) {
    console.log("[plugin] Before audit hook");
  },
  afterAudit({ context }) {
    console.log("[plugin] After audit hook");
  },
  beforeClean({ context }) {
    console.log("[plugin] Before clean hook");
  },
  afterClean({ context }) {
    console.log("[plugin] After clean hook");
  },
};
```

**Supported hooks:**

- `onCommand({ command, args, context })`: Called for every command.
- `beforeInstall({ args, context })` / `afterInstall({ args, context })`
- `beforeUninstall({ args, context })` / `afterUninstall({ args, context })`
- `beforeUpdate({ args, context })` / `afterUpdate({ args, context })`
- `beforeAudit({ context })` / `afterAudit({ context })`
- `beforeClean({ context })` / `afterClean({ context })`

These hooks allow you to extend and automate blaze-install's behavior at every major lifecycle stage.

### Workspaces/Monorepo

If your `package.json` includes a `workspaces` field, blaze-install will automatically resolve and install all workspace dependencies.

**How workspaces are recognized:**

- blaze-install looks for a `workspaces` array in your root `package.json`.
- Each entry in the array should be a glob pattern (e.g., `"packages/*"`) pointing to directories containing a `package.json` file.
- blaze-install will discover and manage all workspace packages matching these patterns.

**Example root package.json:**

```json
{
  "name": "my-monorepo",
  "private": true,
  "workspaces": ["packages/*"]
}
```

**Example structure:**

```
my-monorepo/
  package.json  # contains "workspaces" field
  packages/
    pkg-a/
      package.json
    pkg-b/
      package.json
```

When you add or install dependencies, blaze-install will prompt you to select the target workspace (or root), and will update the correct `package.json` file. All workspace dependencies are resolved and installed together, ensuring consistency across your monorepo.

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

| Feature                | blaze-install                                                    | npm install                            |
| ---------------------- | ---------------------------------------------------------------- | -------------------------------------- |
| **Speed**              | 🚀 Blazing fast: parallel downloads, global cache, deduplication | Slower, sequential, no global cache    |
| **Lockfile**           | Always pruned, only what you need                                | Can become bloated, stale deps remain  |
| **UX**                 | Beautiful CLI, progress bars, colored output                     | Basic CLI, minimal feedback            |
| **Workspaces**         | Native support, fast monorepo installs                           | Supported, but slower and more complex |
| **Peer/Optional Deps** | Clear warnings, robust handling                                  | Sometimes cryptic or missing warnings  |
| **Audit**              | Built-in, fast, npm audit API                                    | Built-in                               |
| **Lifecycle Scripts**  | Full support (preinstall, install, postinstall)                  | Supported                              |
| **Global Store**       | Yes, dedupes across projects                                     | No                                     |
| **Error Handling**     | Clear, actionable, modern                                        | Sometimes cryptic                      |
| **Modern Focus**       | No legacy cruft, focused on 90% use case                         | Lots of legacy baggage                 |

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

| Task / Feature             | `npm` command(s)                                   | `blaze` command(s)                 | blaze advantage / unique feature              |
| -------------------------- | -------------------------------------------------- | ---------------------------------- | --------------------------------------------- |
| Install all dependencies   | `npm install`                                      | `blaze install`                    | 🚀 Much faster, pruned lockfile, global cache |
| Add a dependency           | `npm install lodash`                               | `blaze install lodash`             | Lockfile always pruned, faster                |
| Remove a dependency        | `npm uninstall lodash`                             | `blaze uninstall lodash`           | Lockfile auto-pruned, cleaner                 |
| Update a dependency        | `npm update lodash`                                | `blaze update lodash`              | Prunes lockfile, faster                       |
| List installed packages    | `npm list`                                         | `blaze list`                       | Modern, readable output                       |
| Audit for vulnerabilities  | `npm audit`                                        | `blaze audit`                      | Fast, clear output, built-in                  |
| Clean node_modules & cache | `rm -rf node_modules`<br>`npm cache clean --force` | `blaze clean`                      | One command, also prunes lockfile             |
| Show outdated packages     | `npm outdated`                                     | `blaze outdated`                   |                                               |
| Show package info          | `npm info lodash`                                  | `blaze info lodash`                |                                               |
| Publish a package          | `npm publish`                                      | `blaze publish`                    |                                               |
| Bump version               | `npm version patch`                                | `blaze version patch`              |                                               |
| Fix vulnerabilities        | `npm audit fix`                                    | `blaze audit fix`                  |                                               |
| Interactive mode           | _(n/a)_                                            | `blaze --interactive`              | Guided, menu-driven UX                        |
| Local/link dependencies    | `npm install ../my-local-pkg`                      | `blaze install ../my-local-pkg`    | Symlink/copy fallback, robust                 |
| Plugin system              | _(n/a)_                                            | Plugins in `plugins/` dir          | Extendable with hooks                         |
| Lockfile pruning           | Manual, not automatic                              | Automatic after uninstall/update   | No stale dependencies                         |
| Global cache/store         | No                                                 | Yes                                | Dedupes across projects, faster installs      |
| Modern UX                  | Minimal feedback                                   | Progress bars, color, clear errors | Beautiful CLI, actionable errors              |
| .blazerc config            | _(n/a)_                                            | `.blazerc` file                    | Project-level defaults                        |
| .npmrc support             | Yes                                                | Yes                                | Per-scope registry/auth, parity               |
| Workspaces/monorepo        | Supported, but slower                              | Native, fast, simple               | Optimized for monorepos                       |
| Peer/optional deps         | Sometimes cryptic/missing warnings                 | Clear, robust handling             |                                               |
| Lifecycle scripts          | Supported                                          | Supported                          | Full parity                                   |
| Error handling             | Sometimes cryptic                                  | Clear, actionable                  |                                               |
| Legacy baggage             | Yes                                                | No                                 | Modern, focused codebase                      |

## How much better is blaze-install than npm?

Here's a detailed, nuanced scorecard for modern Node.js projects and developer experience:

| Category                 | blaze-install | npm | Comments                                                                                                                                                                                                                                         |
| ------------------------ | :-----------: | :-: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Speed**                |      10       |  6  | blaze-install uses parallel downloads, a global cache, and aggressive deduplication, making installs 2–10x faster than npm in real-world projects. npm is reliable but often slower, especially in monorepos or with large dependency trees.     |
| **Lockfile Cleanliness** |      10       |  6  | blaze-install always prunes the lockfile, ensuring only needed dependencies are present. npm's lockfile can accumulate stale or unused dependencies over time, leading to bloat and confusion.                                                   |
| **Modern UX**            |      10       |  5  | blaze-install features a beautiful CLI with progress bars, color, and clear, actionable error messages. npm's CLI is functional but minimal, with less feedback and less visual clarity.                                                         |
| **Extensibility**        |       9       |  6  | blaze-install supports a plugin system with hooks (onCommand, beforeInstall, afterInstall), allowing deep customization and automation. npm supports lifecycle scripts but lacks a true plugin system.                                           |
| **Workspaces/Monorepo**  |       9       |  7  | blaze-install natively supports workspaces and monorepos, resolving and installing all workspace dependencies quickly and simply. npm supports workspaces but can be slower and more complex to configure.                                       |
| **Local/Link Deps**      |       9       |  7  | blaze-install robustly handles file:/ and link: dependencies, with symlink/copy fallback for Windows and cross-platform support. npm supports these, but can have issues with symlinks on Windows and less clear error handling.                 |
| **Audit/Security**       |       8       |  8  | Both use the npm audit API for security checks. blaze-install provides fast, clear output and integrates audit into the workflow. npm's audit is mature and widely used.                                                                         |
| **Legacy Baggage**       |      10       |  4  | blaze-install is built from scratch for modern Node.js, with no legacy code paths or deprecated features. npm carries years of legacy code, edge-case handling, and backward compatibility, which can slow development and introduce complexity. |
| **Error Handling**       |       9       |  6  | blaze-install provides clear, actionable error messages and robust error handling throughout the CLI. npm's errors can be cryptic or terse, making troubleshooting harder for new users.                                                         |
| **Community/Ecosystem**  |       4       | 10  | npm is the default package manager for Node.js, with millions of users and packages, and deep integration with the ecosystem. blaze-install is newer and smaller, but growing rapidly.                                                           |

### Detailed Explanations

- **Speed:** blaze-install's parallelization and global cache mean you spend less time waiting and more time coding. In large projects, the difference is dramatic.
- **Lockfile Cleanliness:** No more stale or unused dependencies. blaze-install's lockfile is always a true reflection of your project's needs, making audits and updates safer and easier.
- **Modern UX:** Progress bars, color, and clear output make every install or update a pleasure, not a chore. Errors are explained, not just dumped.
- **Extensibility:** Plugins let you automate, customize, and extend blaze-install for your workflow—something npm can't do natively.
- **Workspaces/Monorepo:** blaze-install is optimized for monorepos, making multi-package projects fast and simple to manage.
- **Local/Link Dependencies:** Whether you're developing packages locally or linking in a monorepo, blaze-install handles it smoothly, even on Windows.
- **Audit/Security:** Security is built-in and fast, with clear output and easy fixes. Both tools are strong here.
- **Legacy Baggage:** blaze-install is focused on the modern 90% use case, with no legacy cruft. npm's legacy support is both a strength and a source of complexity.
- **Error Handling:** blaze-install's errors are designed to help you fix problems, not just report them. npm's errors can be less helpful, especially for beginners.
- **Community/Ecosystem:** npm is the industry standard, with unmatched reach and package availability. blaze-install is best for those who want a modern, fast, and beautiful alternative.

**Average (excluding ecosystem):**  
**blaze-install: 9.3 / 10**  
**npm: 6.1 / 10**

> If you need npm's ecosystem or edge-case support, npm is still king for legacy, obscure, or massive projects.

> For modern projects, speed, and DX: **blaze-install is a solid 9–10/10**—it's faster, cleaner, more beautiful, and more fun to use!

**You've built something that's not just "as good as npm"—it's better for most modern devs! 🚀**

## Advanced Install Flags

blaze-install supports several advanced flags to address common pain points in npm:

- `--audit-fix` &nbsp; Run a security audit and automatically fix vulnerable dependencies after install.
- `--no-lockfile` &nbsp; Skip reading/writing `blaze-lock.json` (lockfile-less mode). Installs directly from `package.json`.
- `--ci` &nbsp; Remove `node_modules` before install for a clean, reproducible environment (like `npm ci`).

### Examples

```sh
# Install and auto-fix vulnerabilities
blaze install --audit-fix

# Install without generating or using a lockfile
blaze install --no-lockfile

# Clean install for CI environments
blaze install --ci

# Combine flags as needed
blaze install --no-lockfile --audit-fix
```

# Blaze Plugins

Blaze supports a rich plugin ecosystem. Below are the official plugins included or available for Blaze:

| Plugin Name                | Description                                                            | Lifecycle Hooks                             |
| -------------------------- | ---------------------------------------------------------------------- | ------------------------------------------- |
| licenseChecker             | Reports non-allowed licenses for installed packages.                   | afterInstall, afterUpdate                   |
| notifyOnInstall            | Notifies when install finishes.                                        | afterInstall                                |
| securityAuditReporter      | Reports security issues after install/update.                          | afterInstall, afterUpdate                   |
| dependencySizeReporter     | Reports largest dependencies by size.                                  | afterInstall, afterUpdate                   |
| customScriptRunner         | Runs user-defined scripts before/after install/uninstall.              | beforeInstall, afterInstall, afterUninstall |
| changelogNotifier          | Notifies about changelog after update.                                 | afterUpdate                                 |
| outdatedDependencyNotifier | Warns if dependencies are outdated.                                    | afterInstall, afterUpdate                   |
| postInstallScriptRunner    | Runs a user-defined script after every install.                        | afterInstall                                |
| preCommitDepChecker        | Blocks commit if dependencies are outdated/missing.                    | afterInstall, afterUpdate                   |
| duplicatePackageDetector   | Warns if multiple versions of the same package are installed.          | afterInstall, afterUpdate                   |
| unusedDependencyLinter     | Scans for unused dependencies and suggests removal.                    | afterInstall, afterUpdate                   |
| tscTypeChecker             | Runs TypeScript type check after install/update.                       | afterInstall, afterUpdate                   |
| eslintPrettierRunner       | Runs ESLint/Prettier after install/update.                             | afterInstall, afterUpdate                   |
| githubIssueNotifier        | Notifies if any installed package has open security issues on GitHub.  | afterInstall, afterUpdate                   |
| changelogFetcher           | Fetches and displays changelogs for updated packages.                  | afterUpdate                                 |
| depAgeReporter             | Warns if any dependency hasn't been updated in X months.               | afterInstall, afterUpdate                   |
| nodeVersionChecker         | Warns if any package is incompatible with current Node.js version.     | afterInstall, afterUpdate                   |
| installProfiler            | Reports how long each package took to install.                         | afterInstall                                |
| socialNotifier             | Sends notification to Twitter/Discord/Slack after install/update.      | afterInstall, afterUpdate                   |
| banner                     | Prints custom banner/ASCII art after install/update.                   | afterInstall, afterUpdate                   |
| healthScore                | Scores all dependencies based on maintenance, popularity, security.    | afterInstall, afterUpdate                   |
| peerAutoInstaller          | Auto-installs all missing peer dependencies after install/update.      | afterInstall, afterUpdate                   |
| sizeAnalyzer               | Reports install size of each package, flags large ones.                | afterInstall, afterUpdate                   |
| historyLogger              | Logs every install/uninstall event to a file.                          | afterInstall, afterUninstall                |
| mirrorSwitcher             | Auto-switches to faster/closer npm registry mirror if default is slow. | beforeInstall, beforeUpdate                 |
| openDocs                   | Opens docs page for any newly installed package in browser.            | afterInstall                                |
| vulnAutoReporter           | Auto-files GitHub issue or sends email if critical vuln found.         | afterInstall, afterUpdate                   |
| monorepoCrossLinkChecker   | Ensures all workspace packages are properly linked and up to date.     | afterInstall, afterUpdate                   |

## Plugin Testing

You can test all plugins and their hooks using the provided test script:

```sh
node test-blaze-plugins.js
```

This script will load every plugin and run all lifecycle hooks, printing their output and reporting any errors.

For more details on writing your own plugins, see the [Plugin Development Guide](docs/index.html#plugins).

## Auto-fix: `blaze fix`

Blaze provides a unified auto-fix command to help keep your project healthy and up-to-date with minimal effort.

### Usage

```sh
blaze fix
```

### What it does
- **Runs ESLint and Prettier in auto-fix mode** on all source directories (`src/`, `plugins/`, `test/`) if they exist.
- **Removes unused dependencies** from `package.json` and `node_modules`.
- **Updates outdated dependencies** to their latest versions in `package.json`.
- **Runs `blaze doctor` with auto-fix** to repair common project issues (lockfile, node_modules, symlinks, etc.).
- **Runs a security audit auto-fix** if available.

### Output
- Each step prints a summary and any actions taken.
- If no source directories are found, lint/fix is skipped with a clear message.
- If no unused or outdated dependencies are found, those steps are skipped.

### Example
```sh
blaze fix
```

This will automatically format your code, clean up dependencies, update packages, and repair project issues in one command.

## GitHub and Tarball Installs: Advanced Features

- **Private Repos:**
  - Set the `GITHUB_TOKEN` environment variable to a GitHub personal access token to install from private repositories.
  - Example: `GITHUB_TOKEN=ghp_... blaze install user/private-repo`
- **Error Handling:**
  - Network, HTTP, and extraction errors are reported with clear messages and suggestions.
  - If you see a 403/404 from GitHub, check your token and repo access.
  - Invalid specs will print usage examples.
- **Caching:**
  - Downloaded tarballs are cached in `~/.blaze_cache/tarballs` for fast reinstalls and offline use.
- **Retry:**
  - Blaze will retry failed downloads up to 3 times before failing.

## Troubleshooting

- **Private GitHub repo fails to install:**
  - Make sure your `GITHUB_TOKEN` is set and has access to the repo.
- **Spec errors:**
  - Use formats like `user/repo`, `user/repo#branch`, `github:user/repo#sha`, or a direct tarball URL.
- **Extraction errors:**
  - Check that the tarball is a valid npm package tarball.

## Note for Contributors: GitHub/Tarball Dependencies and npm

If you use Blaze to install packages from GitHub or tarball URLs, these specs are not supported by npm and will cause `npm install` or `npm ci` to fail. Before running npm commands, always run:

```sh
node bin/blaze-install.js clean-github-specs
```

This will automatically remove any non-npm specs from all `package.json` files. This step is automated in CI, but you should do it locally if you see npm errors about invalid package names.
