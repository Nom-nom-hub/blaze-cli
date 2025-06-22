<p align="center">
  <img src="https://raw.githubusercontent.com/TrialLord/Blazed-install/main/logo.svg" alt="blaze-install logo" width="180"/>
</p>

# blaze-install

A blazing fast, modern alternative to `npm install` for Node.js projects.

---

## Why blaze-install?

- 🚀 **Speed:** Parallel downloads, global cache, and deduplication make installs much faster than npm.
- 📦 **Clean lockfile:** Only what you need, always pruned—no stale dependencies.
- 🎨 **Beautiful CLI:** Progress bars, colored output, and clear feedback.
- 🏗️ **Workspaces/monorepo support:** Fast, native support for modern project structures.
- 🔒 **Security:** Built-in audit using the npm audit API.
- 🧩 **Peer/optional dependencies:** Robust handling and clear warnings.
- 🔄 **Lifecycle scripts:** Full support for preinstall, install, and postinstall.
- 🛠️ **Uninstall/update:** Easy, with automatic lockfile pruning.
- 💥 **No legacy cruft:** Focused on the 90% use case for modern Node.js projects.

---

## Feature Comparison

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

---

## Installation

```sh
npm install -g blaze-install
```

Or use in your project:

```sh
npm install blaze-install --save-dev
```

---

## Usage

```sh
blaze install                # Install all dependencies from package.json
blaze install <package>      # Add and install a package
blaze uninstall <package>    # Remove a package and prune lockfile
blaze update <package>       # Update a package to the latest version
blaze audit                  # Run a security audit
```

### Options
- `--save-dev` Add to devDependencies
- `--production` Only install production dependencies
- `--symlink` Use symlinks instead of copying (for local development)

---

## Project Philosophy

- **Speed and simplicity first**
- **No legacy baggage**
- **Clear, actionable feedback**
- **Easy to contribute and extend**

---

## Contributing

Pull requests and issues are welcome! Please open an issue for bugs, feature requests, or questions.

---

## License

MIT 