const fs = require("fs");
const path = require("path");

function getAllFiles(dir, exts, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, exts, fileList);
    } else if (exts.some((ext) => file.endsWith(ext))) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scanForUnusedDeps() {
  const pkgPath = path.join(process.cwd(), "package.json");
  if (!fs.existsSync(pkgPath)) return;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const deps = Object.keys(pkg.dependencies || {});
  if (!deps.length) return;
  const files = getAllFiles(process.cwd(), [".js", ".ts", ".jsx", ".tsx"]);
  const used = new Set();
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const dep of deps) {
      const depEscaped = escapeRegExp(dep);
      const re = new RegExp(`require\\(['"]${depEscaped}['"]\\)|from ['"]${depEscaped}['"]|import ['"]${depEscaped}['"]`);
      if (re.test(content)) used.add(dep);
    }
  }
  const unused = deps.filter((dep) => !used.has(dep));
  if (unused.length) {
    console.warn("[unusedDependencyLinter] Unused dependencies found:");
    unused.forEach((dep) => console.warn(`  - ${dep}`));
  } else {
    console.log("[unusedDependencyLinter] No unused dependencies found.");
  }
  return unused;
}

function removeUnusedDeps() {
  const unused = scanForUnusedDeps();
  if (!unused || unused.length === 0) {
    console.log("[unusedDependencyLinter] No unused dependencies to remove.");
    return;
  }
  const pkgPath = path.join(process.cwd(), "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  for (const dep of unused) {
    delete pkg.dependencies[dep];
    try {
      const modPath = path.join(process.cwd(), "node_modules", dep);
      if (fs.existsSync(modPath)) {
        fs.rmSync(modPath, { recursive: true, force: true });
      }
      console.log(`[unusedDependencyLinter] Removed unused dependency: ${dep}`);
    } catch {}
  }
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf8");
  console.log("[unusedDependencyLinter] package.json updated.");
}

module.exports = {
  afterInstall: scanForUnusedDeps,
  afterUpdate: scanForUnusedDeps,
  removeUnusedDeps,
};
