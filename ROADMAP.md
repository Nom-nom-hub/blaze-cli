# Blaze-install Roadmap (2025–2027)

## Completed Milestones

- [x] Fast, parallelized installs with global cache
- [x] Content-addressable storage (CAS) for tarballs
- [x] Robust lockfile and dependency management
- [x] Workspace/monorepo support (workspaces field, multi-package installs)
- [x] Plugin system with before/after hooks for all major commands
- [x] Peer and optional dependency support with clear warnings
- [x] Self-healing and diagnostics (`blaze doctor`, `--fix`)
- [x] Offline mode (`--offline`) for cache-only installs
- [x] Prefetch/cache warming (`blaze prefetch`)
- [x] Interactive upgrades (`blaze upgrade`)
- [x] Dependency graph output (Mermaid.js)
- [x] Modern, beautiful CLI with progress bars and colored output
- [x] Automatic lockfile pruning after uninstall/update
- [x] Audit/security checks using npm audit API
- [x] Lifecycle script support (preinstall, install, postinstall)
- [x] Robust error handling and reporting
- [x] Comprehensive documentation and changelog

**Performance:**
- 🚀 Real-world installs are typically **2–10x faster** than npm, especially in monorepos and large projects.
- Lockfile is always pruned, so no stale dependencies slow down future installs.
- Global cache and parallelization mean repeated installs are nearly instant after the first run.

This roadmap outlines the planned evolution of blaze-install over the next two years. Timelines are estimates and may shift based on community feedback and priorities.

---

## **Q3 2025**
- **Stability & Polish**
  - Bug fixes and performance improvements
  - More robust error handling and diagnostics
  - Improved test coverage and CI
- **Plugin System Enhancements**
  - Allow plugins to add custom commands
  - Plugin marketplace/discovery docs
- **Documentation**
  - More examples, migration guides, and advanced usage docs

## **Q4 2025**
- **Advanced Monorepo Tools**
  - Smarter workspace linking/unlinking
  - Batch upgrades and workspace-aware scripts
  - Workspace dependency deduplication/hoisting
- **Security**
  - Signature verification for packages (if/when npm supports it)
  - Custom registry authentication improvements
- **Community**
  - Launch Discord/Matrix for support
  - First community plugins and showcase

## **Q1 2026**
- **Performance & UX**
  - Even faster install algorithms
  - Richer CLI output (summary tables, install stats)
  - `--json` output for all commands (CI-friendly)
- **Self-Healing & AI**
  - More advanced rule-based diagnostics
  - Interactive doctor/auto-fix flows
- **Prefetch/Offline**
  - Smarter prefetch (predictive, workspace-aware)
  - Offline diagnostics and cache health checks

## **Q2 2026**
- **Ecosystem & Integrations**
  - VSCode extension for blaze-install
  - GitHub Actions and CI templates
  - API for programmatic usage
- **Security**
  - Built-in license compliance checks
  - Enhanced audit/fix flows

## **Q3 2026**
- **Community Growth**
  - Monthly community calls
  - Hackathons and plugin competitions
  - Contributor onboarding improvements
- **Enterprise Features**
  - Private registry support
  - Policy enforcement plugins (blocklist/allowlist, version pinning)

## **Q4 2026**
- **Ecosystem Expansion**
  - Integration with other package managers (pip, cargo, etc.)
  - Multi-language monorepo support (experimental)
- **Advanced Analytics**
  - Usage stats (opt-in)
  - Performance dashboards

## **2027 and Beyond**
- **Adoption & Advocacy**
  - Case studies and migration stories
  - Partnerships with cloud and CI providers
- **Continuous Improvement**
  - Respond to user feedback and evolving best practices
  - Ongoing performance, security, and UX enhancements

---

**Note:**
- This roadmap is community-driven. Feature requests, feedback, and contributions are always welcome!
- Priorities may shift based on user needs and ecosystem changes. 