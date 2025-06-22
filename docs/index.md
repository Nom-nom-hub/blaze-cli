<p align="center">
  <img src="https://raw.githubusercontent.com/TrialLord/Blazed-install/main/logo.svg" alt="blaze-install logo" width="180"/>
</p>

<h1 align="center">blaze-install</h1>

<p align="center"><b>The blazing fast, modern alternative to <code>npm install</code> for Node.js projects.</b></p>

---

<p align="center">
  <a href="https://www.npmjs.com/package/blaze-install"><img src="https://img.shields.io/npm/v/blaze-install?color=orange&label=npm" alt="npm version"></a>
  <a href="https://github.com/TrialLord/Blazed-install"><img src="https://img.shields.io/github/stars/TrialLord/Blazed-install?style=social" alt="GitHub stars"></a>
</p>

---

## 🚀 Get Started

```sh
npm install -g blaze-install
```

Or add to your project:

```sh
npm install blaze-install --save-dev
```

---

## 🌟 Why blaze-install?

<div align="center">

| 🚀 **Speed** | 📦 **Clean Lockfile** | 🎨 **Beautiful CLI** | 🏗️ **Workspaces** | 🔒 **Security** |
|:---:|:---:|:---:|:---:|:---:|
| Parallel downloads, global cache, deduplication | Always pruned, no stale deps | Progress bars, color, clear feedback | Fast, native monorepo support | Built-in audit, npm audit API |

</div>

- **Much faster installs** than npm thanks to parallelization and a global cache.
- **Cleaner lockfile**: Only what you need, always pruned.
- **Better developer experience**: Progress bars, color, and clear output.
- **Automatic lockfile pruning** after uninstall/update.
- **Modern workflows**: Workspaces, peer/optional deps, lifecycle scripts.
- **No legacy code paths**: Focused on what modern Node.js projects need.

---

## 🔥 Feature Comparison

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

## 📖 Usage

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

## 💡 Project Philosophy

- **Speed and simplicity first**
- **No legacy baggage**
- **Clear, actionable feedback**
- **Easy to contribute and extend**

---

## 🤝 Contributing

Pull requests and issues are welcome! Please open an issue for bugs, feature requests, or questions.

---

## 📫 Links & Resources

- [GitHub Repository](https://github.com/TrialLord/Blazed-install)
- [npm Package](https://www.npmjs.com/package/blaze-install)
- [Documentation](https://triallord.github.io/Blazed-install/)

---

<p align="center"><b>blaze-install is the future of Node.js dependency management. Join the revolution!</b></p> 