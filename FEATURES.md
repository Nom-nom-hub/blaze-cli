# blaze-install Features

blaze-install is a modern, blazing fast Node.js package manager with a rich set of features for developers, teams, and monorepos. Below is a comprehensive list of all implemented features, grouped by category, with details for each.

---

## 🏗️ Core Package Management

- **Install dependencies** (`blaze install`)
  - Installs all dependencies from package.json and lockfile, or adds a new package if specified.
- **Add a package** (`blaze install <package>`)
  - Installs and adds a package to dependencies or devDependencies.
- **Uninstall a package** (`blaze uninstall <package>`)
  - Removes a package and prunes the lockfile automatically.
- **Update a package** (`blaze update <package>`)
  - Updates a package to the latest version and prunes the lockfile.
- **List installed packages** (`blaze list`)
  - Shows all installed dependencies in a modern, readable format.
- **Show outdated packages** (`blaze outdated`)
  - Lists dependencies that are out of date.
- **Show package info** (`blaze info <package>`)
  - Displays detailed information about a package from the registry.
- **Publish a package** (`blaze publish`)
  - Publishes your package to the npm registry, respecting .npmrc settings.
- **Bump version** (`blaze version <newversion>`)
  - Bumps the version, commits, and tags the release.
- **Clean node_modules & cache** (`blaze clean`)
  - Removes node_modules and cleans the global cache. Also prunes the lockfile.
- **Prune lockfile**
  - Lockfile is automatically pruned after uninstall/update to remove stale dependencies.
- **Full dependency tree resolution**
  - Handles all dependencies and lockfile support for reproducible installs.

---

## 🚀 Performance & Reliability

- **Blazing fast installs**
  - Parallel downloads, global cache, metadata caching, and deduplication for instant installs.
- **Global cache/store**
  - Stores downloaded packages in a global cache in the user's home directory, deduping across projects for maximum speed.
- **Offline mode** (`--offline`)
  - Installs from local cache only; no network requests. Fails if a required package or metadata is missing from the cache.
- **Prefetch/cache warming** (`blaze prefetch`)
  - Downloads and caches all dependencies and tarballs for offline use, without installing them.

---

## 🛡️ Security & Diagnostics

- **Audit/security checks** (`blaze audit`)
  - Uses the npm audit API to check for vulnerabilities in your dependencies.
- **Audit fix** (`blaze audit fix`)
  - Attempts to automatically fix vulnerabilities by updating packages.
- **Self-healing & diagnostics** (`blaze doctor [--fix]`)
  - Checks for missing/corrupt node_modules, lockfile/package.json mismatches, and broken symlinks. With `--fix`, auto-repairs common issues.
- **Robust error handling**
  - Provides clear, actionable error messages and reporting for all commands.

---

## 🧩 Dependency Handling

- **Peer and optional dependency support**
  - Prints clear warnings for missing/incompatible peer dependencies. Prompts to auto-install missing peers if not in offline mode.
- **Lifecycle scripts**
  - Full support for preinstall, install, postinstall, and other npm lifecycle scripts.

---

## 🧑‍💻 Developer Experience

- **Beautiful CLI**
  - Colored output, progress bars, and interactive upgrades for a modern experience.
- **Interactive mode** (`blaze --interactive`)
  - Guided, menu-driven workflow for all major commands.
- **Modern UX**
  - Progress bars, color, and clear output for every install or update.

---

## 🕸️ Advanced Features

- **Workspaces/monorepo support**
  - Native, fast, and simple workspace management via the `workspaces` field in package.json. Resolves and installs all workspace dependencies together.
- **Dependency graph** (`blaze graph`)
  - Outputs a Mermaid.js diagram of your dependency tree for visualization.
- **Plugin system**
  - Extend and automate blaze-install with before/after hooks for all major commands. Place plugins in the `plugins/` directory.
- **.blazerc config**
  - Project-level config file for default CLI options (e.g., symlink, production, saveDev).
- **.npmrc support**
  - Reads registry and authentication settings from both project and user `.npmrc` files for publishing, installing, and auditing.
- **Advanced flags**
  - Supports `--audit-fix`, `--no-lockfile`, `--ci`, `--offline`, `--json`, `--symlink`, and more for advanced workflows.

---

## 📚 Documentation & Help

- **Comprehensive CLI help/docs** (`blaze --help`)
  - Built-in help for all commands and options.
- **Extensive README and website documentation**
  - Full usage, advanced flags, migration guides, and feature comparisons.

---

## 🧩 Extensibility: Plugin Hooks

- `onCommand({ command, args, context })`: Called for every command.
- `beforeInstall({ args, context })` / `afterInstall({ args, context })`
- `beforeUninstall({ args, context })` / `afterUninstall({ args, context })`
- `beforeUpdate({ args, context })` / `afterUpdate({ args, context })`
- `beforeAudit({ context })` / `afterAudit({ context })`
- `beforeClean({ context })` / `afterClean({ context })`

These hooks allow you to extend and automate blaze-install's behavior at every major lifecycle stage.

---

## 🏢 Workspaces/Monorepo Details

- **Recognition**: blaze-install looks for a `workspaces` array in your root `package.json`.
- **Globs**: Each entry should be a glob pattern (e.g., `"packages/*"`) pointing to directories with a `package.json`.
- **Management**: All workspace dependencies are resolved and installed together, ensuring consistency across your monorepo.

---

## 🛠️ Configuration Files

- **.blazerc**: Set project-level defaults for CLI options.
- **.npmrc**: Registry/auth parity with npm for installs, audits, and publishing.

---

For more details, see the README or run `blaze --help` in your project.

---

## 🧩 Official Example Plugins

Blaze comes with a set of example plugins to showcase the power and flexibility of its plugin system. These plugins can be found in the `plugins/` directory and are ready to use or customize:

- **License Checker**
  - Warns if any installed packages have non-allowed licenses after install/update.
  - Hooks: `afterInstall`, `afterUpdate`
- **Notify On Install**
  - Prints a terminal notification when an install finishes.
  - Hook: `afterInstall`
- **Security Audit Reporter**
  - Prints a summary after `blaze audit` (with a placeholder for sending results to a webhook).
  - Hook: `afterAudit`
- **Dependency Size Reporter**
  - Reports the largest dependencies (by size) after install/update.
  - Hooks: `afterInstall`, `afterUpdate`
- **Custom Script Runner**
  - Runs custom shell scripts before/after install/uninstall, reading from a `.blazepluginrc` config file.
  - Hooks: `beforeInstall`, `afterInstall`, `beforeUninstall`, `afterUninstall`
- **Changelog Notifier**
  - After updating a package, prints a placeholder for changelog/release notes (can be extended to fetch from npm or GitHub).
  - Hook: `afterUpdate`
- **Outdated Dependency Notifier**
  - Warns if any dependencies are outdated after install/update (placeholder for real version check).
  - Hooks: `afterInstall`, `afterUpdate`

These plugins demonstrate how easy it is to extend Blaze for real-world needs. You can write your own plugins using the same hooks and drop them into the `plugins/` directory.
