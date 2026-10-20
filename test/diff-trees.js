#!/usr/bin/env node
/**
 * Compare two `node_modules` trees and report the differences.
 *
 * Used by CI to check that `blaze install` produces a tree equivalent to
 * `npm ci`. Any package present in one tree but not the other is reported,
 * as are version mismatches and missing `.bin` shims.
 *
 * Usage:
 *   node test/diff-trees.js <npm-node_modules> <blaze-node_modules> [options]
 *
 * Options:
 *   --json           Emit a JSON report instead of text
 *   --allow-missing  Treat packages missing from the blaze tree as warnings
 *                    rather than errors (exit code still 0)
 *   --ignore <names> Comma-separated list of package names to ignore
 *   --baseline <file> JSON file of known-acceptable differences. Differences
 *                    that are already recorded there are reported as
 *                    "known" and do not fail the run; anything new does.
 *                    Use --update-baseline to write the current result.
 *
 * Exit codes:
 *   0 - trees match (within the configured tolerance)
 *   1 - differences were found that should be treated as failures
 */

const fs = require("fs");
const path = require("path");

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith("--"));
const flags = new Set(argv.filter((a) => a.startsWith("--")));

function flagValue(name) {
  const idx = argv.indexOf(name);
  if (idx === -1 || idx === argv.length - 1) return null;
  return argv[idx + 1];
}

const npmDir = positional[0];
const blazeDir = positional[1];

if (!npmDir || !blazeDir) {
  console.error(
    "Usage: node test/diff-trees.js <npm-node_modules> <blaze-node_modules> [--json] [--allow-missing] [--ignore a,b]",
  );
  process.exit(2);
}

const allowMissing = flags.has("--allow-missing");
const ignoreRaw = flagValue("--ignore");
const ignored = new Set(
  (ignoreRaw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);
const baselinePath = flagValue("--baseline");
const updateBaseline = flags.has("--update-baseline");

/**
 * List the packages in a node_modules tree, expanding scoped packages.
 * Returns a Map of name -> { version, hasBin, binNames }.
 */
function readTree(dir) {
  const result = new Map();
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    if (entry.name.startsWith(".")) continue;
    if (entry.name.startsWith("@")) {
      let scoped;
      try {
        scoped = fs.readdirSync(path.join(dir, entry.name), {
          withFileTypes: true,
        });
      } catch {
        continue;
      }
      for (const child of scoped) {
        if (!child.isDirectory() && !child.isSymbolicLink()) continue;
        addPackage(result, dir, entry.name, child.name);
      }
      continue;
    }
    addPackage(result, dir, null, entry.name);
  }
  return result;
}

function addPackage(result, dir, scope, name) {
  const pkgDir = scope
    ? path.join(dir, scope, name)
    : path.join(dir, name);
  let manifest = null;
  try {
    manifest = JSON.parse(
      fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"),
    );
  } catch {
    manifest = null;
  }
  const binNames = [];
  if (manifest && manifest.bin) {
    if (typeof manifest.bin === "string") {
      binNames.push(name.split("/").pop());
    } else {
      binNames.push(...Object.keys(manifest.bin));
    }
  }
  result.set(scope ? `${scope}/${name}` : name, {
    version: manifest ? manifest.version : null,
    hasBin: binNames.length > 0,
    binNames,
  });
}

const npmTree = readTree(npmDir);
const blazeTree = readTree(blazeDir);

const missingFromBlaze = [];
const extraInBlaze = [];
const versionMismatches = [];
const missingBinShims = [];

for (const [name, info] of npmTree) {
  if (ignored.has(name)) continue;
  const other = blazeTree.get(name);
  if (!other) {
    missingFromBlaze.push(name);
    continue;
  }
  if (info.version && other.version && info.version !== other.version) {
    versionMismatches.push({
      name,
      npm: info.version,
      blaze: other.version,
    });
  }
  if (info.hasBin) {
    for (const binName of info.binNames) {
      // On Windows the `.cmd` shim is what `npm run` actually executes.
      // The extension-less file is a POSIX `sh` script that cmd cannot
      // run, and the `.ps1` only works under PowerShell - so only the
      // `.cmd` counts as present.
      const candidates =
        process.platform === "win32" ? [`${binName}.cmd`] : [binName];
      const found = candidates.some((c) =>
        fs.existsSync(path.join(blazeDir, ".bin", c)),
      );
      if (!found) {
        missingBinShims.push({ name, bin: binName });
      }
    }
  }
}

for (const name of blazeTree.keys()) {
  if (ignored.has(name)) continue;
  if (!npmTree.has(name)) extraInBlaze.push(name);
}

// Compare the set of `.bin` entries too.
//
// On Windows a usable shim is the `.cmd` variant (`.ps1` is the
// PowerShell equivalent, and the extension-less file is the POSIX `sh`
// script). A base name alone is not enough: if the `.cmd` were deleted but
// the `.ps1` remained, the tool would still appear to exist even though
// `npm run` on Windows would fail. So the variants are tracked separately.
function readBinDir(dir) {
  const binDir = path.join(dir, ".bin");
  let files;
  try {
    files = fs.readdirSync(binDir);
  } catch {
    return { names: new Set(), cmd: new Set(), ps1: new Set(), plain: new Set() };
  }
  const names = new Set();
  const cmd = new Set();
  const ps1 = new Set();
  const plain = new Set();
  for (const file of files) {
    if (file.endsWith(".cmd")) {
      const base = file.replace(/\.cmd$/, "").replace(/\.exe$/, "");
      names.add(base);
      cmd.add(base);
    } else if (file.endsWith(".ps1")) {
      const base = file.replace(/\.ps1$/, "").replace(/\.exe$/, "");
      names.add(base);
      ps1.add(base);
    } else {
      const base = file.replace(/\.exe$/, "");
      names.add(base);
      plain.add(base);
    }
  }
  return { names, cmd, ps1, plain };
}
const npmBinDir = readBinDir(npmDir);
const blazeBinDir = readBinDir(blazeDir);

// A `.bin` entry counts as present only if the same *kind* of shim exists
// in the blaze tree.
//
// On Windows, `cmd.exe` resolves a command through PATHEXT
// (.COM;.EXE;.BAT;.CMD;...). The extension-less file is a POSIX `sh`
// script that cmd cannot execute, and the `.ps1` only works under
// PowerShell. So the `.cmd` is the variant that actually makes a tool
// runnable from an `npm run` script, and it is the one required here -
// a deleted `.cmd` is reported even when `.ps1` and the `sh` script
// survive.
function binEntryPresent(binName) {
  if (process.platform === "win32") {
    return blazeBinDir.cmd.has(binName);
  }
  return blazeBinDir.plain.has(binName);
}

const missingBins = [...npmBinDir.names].filter(
  (b) => !binEntryPresent(b) && !ignored.has(b),
);

const report = {
  npmPackages: npmTree.size,
  blazePackages: blazeTree.size,
  missingFromBlaze: missingFromBlaze.sort(),
  extraInBlaze: extraInBlaze.sort(),
  versionMismatches,
  missingBinShims,
  missingBins: missingBins.sort(),
  ignored: [...ignored].sort(),
};

/**
 * Build the comparable "difference" key set for the current run. These are
 * the things a baseline can whitelist.
 */
function diffKeys(r) {
  const keys = new Set();
  for (const n of r.missingFromBlaze) keys.add(`missing:${n}`);
  for (const n of r.extraInBlaze) keys.add(`extra:${n}`);
  for (const m of r.versionMismatches) {
    keys.add(`version:${m.name}:${m.npm}:${m.blaze}`);
  }
  for (const b of r.missingBinShims) keys.add(`binshim:${b.name}:${b.bin}`);
  for (const b of r.missingBins) keys.add(`bin:${b}`);
  return keys;
}

let baseline = null;
if (baselinePath && fs.existsSync(baselinePath)) {
  try {
    baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  } catch (err) {
    console.error(`Could not read baseline ${baselinePath}: ${err.message}`);
    process.exit(2);
  }
}

const currentKeys = diffKeys(report);

if (updateBaseline) {
  const payload = {
    description:
      "Known differences between the npm and blaze dependency trees. " +
      "Generated by test/diff-trees.js --update-baseline.",
    differences: [...currentKeys].sort(),
  };
  fs.mkdirSync(path.dirname(baselinePath || "."), { recursive: true });
  fs.writeFileSync(
    baselinePath || "test/baseline-trees.json",
    JSON.stringify(payload, null, 2) + "\n",
    "utf8",
  );
  console.log(
    `Baseline written to ${baselinePath || "test/baseline-trees.json"} (${currentKeys.size} differences)`,
  );
  process.exit(0);
}

let knownDifferences = [];
let newDifferences = [];
if (baseline) {
  const known = new Set(baseline.differences || []);
  knownDifferences = [...currentKeys].filter((k) => known.has(k));
  newDifferences = [...currentKeys].filter((k) => !known.has(k));
  // Also flag baseline entries that no longer occur (the gap was closed).
  const resolved = [...known].filter((k) => !currentKeys.has(k));
  if (resolved.length > 0) {
    console.log(
      `\nℹ️  ${resolved.length} baseline difference(s) no longer occur - the baseline can be regenerated.`,
    );
    for (const k of resolved) console.log(`    - ${k}`);
  }
}

report.knownDifferences = knownDifferences.sort();
report.newDifferences = newDifferences.sort();

if (flags.has("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("Dependency tree comparison");
  console.log("==========================");
  console.log(`  npm packages:   ${report.npmPackages}`);
  console.log(`  blaze packages: ${report.blazePackages}`);
  console.log(
    `  missing from blaze: ${report.missingFromBlaze.length}` +
      (report.missingFromBlaze.length
        ? `\n    - ${report.missingFromBlaze.join("\n    - ")}`
        : ""),
  );
  console.log(
    `  extra in blaze: ${report.extraInBlaze.length}` +
      (report.extraInBlaze.length
        ? `\n    - ${report.extraInBlaze.join("\n    - ")}`
        : ""),
  );
  console.log(
    `  version mismatches: ${report.versionMismatches.length}` +
      (report.versionMismatches.length
        ? `\n    - ${report.versionMismatches
            .map((m) => `${m.name} (npm ${m.npm} vs blaze ${m.blaze})`)
            .join("\n    - ")}`
        : ""),
  );
  console.log(
    `  missing .bin shims: ${report.missingBinShims.length}` +
      (report.missingBinShims.length
        ? `\n    - ${report.missingBinShims.map((m) => `${m.bin} (${m.name})`).join("\n    - ")}`
        : ""),
  );
  console.log(
    `  missing .bin entries: ${report.missingBins.length}` +
      (report.missingBins.length ? `\n    - ${report.missingBins.join("\n    - ")}` : ""),
  );
  if (baseline) {
    console.log(
      `\n  known differences (whitelisted): ${report.knownDifferences.length}`,
    );
    console.log(
      `  NEW differences (regressions):  ${report.newDifferences.length}` +
        (report.newDifferences.length
          ? `\n    - ${report.newDifferences.join("\n    - ")}`
          : ""),
    );
  }
}

const hardFailures = baseline
  ? report.newDifferences.length > 0
  : report.missingBinShims.length > 0 ||
    report.missingBins.length > 0 ||
    report.versionMismatches.length > 0 ||
    (!allowMissing &&
      (report.missingFromBlaze.length > 0 || report.extraInBlaze.length > 0));

if (hardFailures) {
  console.error("\n❌ Tree comparison failed.");
  process.exit(1);
}
console.log("\n✅ Trees are equivalent.");
process.exit(0);
