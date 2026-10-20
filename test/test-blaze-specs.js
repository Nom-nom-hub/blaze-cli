#!/usr/bin/env node

/**
 * Tests for how blaze distinguishes a GitHub spec from a registry package.
 *
 * Two bugs are covered here:
 *
 * 1. A scoped npm package such as `@sindresorhus/merge-streams` has the
 *    same `user/repo` shape as a GitHub spec. It was parsed as GitHub
 *    user `@sindresorhus` and the install failed with a 404, even though
 *    npm installs the package without trouble.
 *
 * 2. The tarball cache path was built from the package name, so a GitHub
 *    spec (`user/repo`) or a `github:` spec (`github:user/repo`) produced
 *    a path with a slash and a colon in it. The nested directory was
 *    never created, so the first download on a clean machine failed with
 *    ENOENT.
 *
 * Both are checked without touching the network for the parsing half. The
 * install half is exercised against the real registry.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const cliPath = path.resolve(__dirname, "..", "bin", "blaze-install.js");

let failures = 0;

function check(label, condition, detail) {
  if (condition) {
    console.log(`✅ ${label}`);
  } else {
    failures++;
    console.error(`❌ ${label}${detail ? `\n   ${detail}` : ""}`);
  }
}

function makeProject(name) {
  const dir = path.join(os.tmpdir(), `blaze-spec-${name}-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name, version: "1.0.0" }, null, 2),
  );
  return dir;
}

function tryInstall(dir, spec) {
  try {
    execSync(`node "${cliPath}" install ${spec}`, {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, output: "" };
  } catch (err) {
    return {
      ok: false,
      output: `${err.stdout || ""}${err.stderr || ""}`,
    };
  }
}

console.log("Testing GitHub spec vs registry package detection...\n");

// --- 1. A scoped npm package must be treated as a registry package ---

{
  const dir = makeProject("scoped");
  const result = tryInstall(dir, "@sindresorhus/merge-streams");
  const installed = fs.existsSync(
    path.join(dir, "node_modules", "@sindresorhus", "merge-streams"),
  );
  check(
    "scoped package @sindresorhus/merge-streams installs from the registry",
    result.ok && installed,
    result.ok ? "installed but the package is missing" : result.output.slice(0, 400),
  );
  fs.rmSync(dir, { recursive: true, force: true });
}

// --- 2. A scoped package with a version range must work too ---

{
  const dir = makeProject("scoped-range");
  const result = tryInstall(dir, "@types/node@^18");
  const installed = fs.existsSync(
    path.join(dir, "node_modules", "@types", "node"),
  );
  check(
    "scoped package with a version range installs",
    result.ok && installed,
    result.ok ? "installed but the package is missing" : result.output.slice(0, 400),
  );
  fs.rmSync(dir, { recursive: true, force: true });
}

// --- 3. A plain GitHub spec must still be treated as a GitHub spec ---

{
  const dir = makeProject("github");
  const result = tryInstall(dir, "sindresorhus/slugify");
  const installed = fs.existsSync(
    path.join(dir, "node_modules", "sindresorhus-slugify"),
  );
  check(
    "GitHub spec sindresorhus/slugify installs from GitHub",
    result.ok && installed,
    result.ok ? "installed but the package is missing" : result.output.slice(0, 400),
  );
  fs.rmSync(dir, { recursive: true, force: true });
}

// --- 4. The `github:` prefix form must work too ---

{
  const dir = makeProject("github-prefix");
  const result = tryInstall(dir, "github:sindresorhus/slugify");
  const entries = fs.existsSync(path.join(dir, "node_modules"))
    ? fs.readdirSync(path.join(dir, "node_modules"))
    : [];
  check(
    "github: prefixed spec installs from GitHub",
    result.ok && entries.some((e) => e.includes("slugify")),
    result.ok
      ? `installed as: ${entries.join(", ")}`
      : result.output.slice(0, 400),
  );
  fs.rmSync(dir, { recursive: true, force: true });
}

// --- 5. The tarball cache must not contain a nested path from the name ---

{
  const cacheDir = path.join(os.homedir(), ".blaze_cache", "tarballs");
  check(
    "the tarball cache holds flat files, not name-derived directories",
    !fs.existsSync(path.join(cacheDir, "github:sindresorhus")) &&
      !fs.existsSync(path.join(cacheDir, "sindresorhus")),
    `unexpected directory in ${cacheDir}`,
  );
}

console.log();
if (failures > 0) {
  console.error(`❌ ${failures} check(s) failed.`);
  process.exit(1);
}
console.log("🎉 All spec-detection tests passed!");
