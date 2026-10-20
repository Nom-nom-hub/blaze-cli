const fs = require("fs/promises");
const path = require("path");

/**
 * Link workspace packages into `node_modules` so they resolve by name.
 *
 * npm links every workspace package into the root `node_modules` folder as
 * a symlink (a Junction on Windows) pointing back at the workspace source
 * directory. That is what makes `require("pkg-b")` work from the repo root
 * even though `pkg-b` is never published to the registry.
 *
 * Blaze resolved workspace *dependencies* but never created these links, so
 * `node_modules/pkg-b` was missing entirely.
 *
 * @param {string} rootDir - the project root
 * @param {string[]} workspacePaths - absolute paths to each workspace dir
 * @param {{verbose?: boolean}} options
 * @returns {Promise<{linked: string[], skipped: string[]}>}
 */
async function linkWorkspaces(rootDir, workspacePaths, options = {}) {
  const verbose = !!options.verbose;
  const nodeModulesDir = path.join(rootDir, "node_modules");
  const linked = [];
  const skipped = [];

  if (!Array.isArray(workspacePaths) || workspacePaths.length === 0) {
    return { linked, skipped };
  }

  await fs.mkdir(nodeModulesDir, { recursive: true });

  for (const wsPath of workspacePaths) {
    let manifest;
    try {
      manifest = JSON.parse(
        await fs.readFile(path.join(wsPath, "package.json"), "utf8"),
      );
    } catch {
      continue;
    }
    if (!manifest || !manifest.name) continue;

    const target = path.join(nodeModulesDir, manifest.name);
    // Never clobber a real installed package with the same name.
    try {
      const stat = await fs.lstat(target);
      // A junction/symlink we previously created is safe to replace.
      if (!stat.isSymbolicLink()) {
        skipped.push(manifest.name);
        if (verbose) {
          console.log(
            `  workspace ${manifest.name} skipped (already installed as a real package)`,
          );
        }
        continue;
      }
      await fs.unlink(target);
    } catch {
      // Does not exist yet - nothing to remove.
    }

    await fs.mkdir(path.dirname(target), { recursive: true });

    try {
      // `junction` resolves to an absolute path on Windows, which is what
      // npm does. A plain symlink would need elevated rights for
      // directories on Windows, so junction is the portable choice there.
      const type = process.platform === "win32" ? "junction" : "dir";
      await fs.symlink(wsPath, target, type);
      linked.push(manifest.name);
      if (verbose) {
        console.log(`  linked ${manifest.name} -> ${wsPath}`);
      }
    } catch (err) {
      // Symlink creation can fail (permissions, or a filesystem without
      // link support). Fall back to a copy so the package still resolves.
      try {
        await fs.cp(wsPath, target, { recursive: true });
        linked.push(manifest.name);
        if (verbose) {
          console.log(
            `  copied ${manifest.name} -> ${wsPath} (symlink failed: ${err.code || err.message})`,
          );
        }
      } catch (copyErr) {
        skipped.push(manifest.name);
        console.warn(
          `⚠ Failed to link workspace ${manifest.name}: ${copyErr.message}`,
        );
      }
    }
  }

  return { linked, skipped };
}

module.exports = { linkWorkspaces };
