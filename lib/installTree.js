const axios = require("axios");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { ensureInStore } = require("./downloadAndExtract");
const cliProgress = require("cli-progress");
const { spawn } = require("child_process");
const chalk = require('chalk');
let boxen = require('boxen');
if (boxen && boxen.default) boxen = boxen.default;

async function runLifecycleScript(pkgDir, scriptName, pkgName) {
  const pkgJsonPath = path.join(pkgDir, "package.json");
  try {
    const data = await fs.readFile(pkgJsonPath, "utf-8");
    const pkg = JSON.parse(data);
    if (pkg.scripts && pkg.scripts[scriptName]) {
      console.log(
        chalk.cyan(`[${pkgName}] Running ${scriptName} script...`),
      );
      await new Promise((resolve) => {
        const child = spawn(
          process.platform === "win32" ? "cmd" : "sh",
          [process.platform === "win32" ? "/c" : "-c", pkg.scripts[scriptName]],
          {
            cwd: pkgDir,
            stdio: "inherit",
          },
        );
        child.on("close", async (code) => {
          if (code !== 0) {
            console.warn(
              chalk.yellow(
                `[${pkgName}] ${scriptName} script failed with code ${code}`,
              ),
            );
          }
          resolve();
        });
      });
    }
  } catch (err) {
    // Ignore errors reading package.json or missing scripts
  }
}

const METADATA_CACHE_DIR = path.join(os.homedir(), ".blaze_metadata_cache");
const TARBALL_CACHE_DIR = path.join(os.homedir(), ".blaze_cache", "tarballs");

async function getTarballUrl(name, version) {
  await fs.mkdir(METADATA_CACHE_DIR, { recursive: true });
  const cacheFile = path.join(
    METADATA_CACHE_DIR,
    `${name.replace("/", "_")}-${version}.json`,
  );
  let metadata;
  try {
    const cachedData = await fs.readFile(cacheFile, "utf-8");
    metadata = JSON.parse(cachedData);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn(
        chalk.yellow(
          `Could not read metadata cache for ${name}@${version}: ${err.message}`,
        ),
      );
    }
    const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`;
    const { data } = await axios.get(url);
    metadata = data;
    try {
      await fs.writeFile(cacheFile, JSON.stringify(data), "utf-8");
    } catch (err) {
      console.warn(
        chalk.yellow(
          `Could not write to metadata cache for ${name}@${version}: ${err.message}`,
        ),
      );
    }
  }
  if (metadata.dist && metadata.dist.tarball) {
    return {
      tarballUrl: metadata.dist.tarball,
      shasum: metadata.dist.shasum,
      integrity: metadata.dist.integrity,
      signature: metadata.dist.signature || null,
    };
  }
  return { tarballUrl: null, shasum: null, integrity: null, signature: null };
}

async function safeRemove(target) {
  try {
    const stat = await fs.lstat(target);
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      // console.log(chalk.gray(`➜ Removing directory at ${target}`));
      await fs.rm(target, { recursive: true, force: true });
    } else if (stat.isSymbolicLink()) {
      // console.log(chalk.gray(`➜ Removing symlink at ${target}`));
      await fs.unlink(target);
    } else {
      // console.log(chalk.gray(`➜ Removing file at ${target}`));
      await fs.unlink(target);
    }
  } catch (err) {
    if (err.code === "ENOENT") {
      // No log for non-existent
    } else {
      throw err;
    }
  }
}

async function handleLocalDep(depName, depSpec, nodeModulesDir) {
  const dest = path.join(nodeModulesDir, depName);
  let src = depSpec.replace(/^(file:|link:)/, "");
  src = path.resolve(process.cwd(), src);
  try {
    await fs.rm(dest, { recursive: true, force: true });
  } catch {}
  if (depSpec.startsWith("file:")) {
    await fs.cp(src, dest, { recursive: true });
    console.log(
      chalk.cyan(`Copied local dependency ${depName} from ${src}`),
    );
  } else if (depSpec.startsWith("link:")) {
    try {
      await fs.symlink(src, dest, "dir");
      console.log(
        chalk.cyan(
          `Symlinked local dependency ${depName} from ${src}`,
        ),
      );
    } catch (err) {
      if (err.code === "EPERM" || err.code === "EEXIST") {
        await fs.cp(src, dest, { recursive: true });
        console.log(
          chalk.cyan(
            `Copied local dependency ${depName} from ${src} (symlink not permitted)`,
          ),
        );
      } else {
        throw err;
      }
    }
  }
}

async function parseGithubSpec(spec) {
  // github:user/repo[#ref] or user/repo[#ref]
  let m = spec.match(/^github:([^/]+)\/([^#]+)(#(.+))?$/);
  if (!m) m = spec.match(/^([^/]+)\/([^#]+)(#(.+))?$/);
  if (!m) return null;
  const user = m[1], repo = m[2];
  const explicitRef = m[4];

  // If the user pinned an explicit ref (branch/tag/SHA), use it as-is and never
  // silently replace it with a default-branch fallback. Otherwise, ask GitHub
  // for the default and bundle the historical 'main'/'master' fallbacks so we
  // can transparently support repos whose default branch is still 'master'.
  let refCandidates;
  if (explicitRef) {
    refCandidates = [explicitRef];
  } else {
    const { getDefaultBranchCandidates } = require('./sshHelper');
    refCandidates = await getDefaultBranchCandidates(user, repo);
  }
  const ref = refCandidates[0];

  return {
    tarballUrl: `https://codeload.github.com/${user}/${repo}/tar.gz/${ref}`,
    sshUrl: `git@github.com:${user}/${repo}.git`,
    name: repo,
    ref,
    refCandidates,
    explicitPinned: !!explicitRef,
    user,
  };
}

function isTarballUrl(spec) {
  return /^https?:\/\/.+\.(tgz|tar\.gz)$/.test(spec);
}

async function downloadWithRetry(url, dest, headers = {}, maxRetries = 3) {
  const axiosOpts = { responseType: "stream", headers };
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, axiosOpts);
      const writer = require("fs").createWriteStream(dest);
      await new Promise((resolve, reject) => {
        response.data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
      });
      return true;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        console.warn(chalk.yellow(`Download failed (attempt ${attempt}): ${err.message}. Retrying...`));
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }
  throw lastErr;
}

const { downloadWithSSH, getGitHubAuthHeaders } = require('./sshHelper');

async function validateGithubOrTarballSpec(spec, gh) {
  // Cheap early-out for tarball URLs.
  if (isTarballUrl(spec)) return true;
  // If the caller already parsed the spec (e.g. worker has `tarballMeta`
  // from the resolution phase), trust that result and skip the second
  // parseGithubSpec call — it would otherwise hit the GitHub API again
  // and increase install latency / rate-limit risk. Single-arg callers
  // still get the old behaviour via the fallback below.
  if (!gh) gh = await parseGithubSpec(spec);
  return !!gh;
}

function sanitizePackageDirName(name) {
  // Replace /, :, #, @, and any non-alphanumeric with -
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

const isVerbose = process.argv.includes('--verbose');



async function installTree(tree, destDir, options = {}) {
  const nodeModulesDir = path.join(destDir, "node_modules");
  await fs.mkdir(nodeModulesDir, { recursive: true });
  const pkgs = Object.entries(tree);
  const bar = new cliProgress.SingleBar({
    format: '{bar} {percentage}% | {value}/{total} 📦',
    barCompleteChar: '█',
    barIncompleteChar: '░',
      hideCursor: true,
    linewrap: false,
    clearOnComplete: false,
    barsize: 30,
  }, cliProgress.Presets.shades_classic);
  bar.start(pkgs.length, 0, { pkg: "" });

  const concurrency = 8;
  let i = 0;

  // Step 1: Resolve all tarball URLs in parallel
  const pkgsWithTarballs = await Promise.all(
    pkgs.map(async ([name, info]) => {
      if (
        info.version &&
        (info.version.startsWith("file:") || info.version.startsWith("link:"))
      ) {
        return {
          name,
          info,
          tarballMeta: {
            tarballUrl: null,
            shasum: null,
            integrity: null,
            signature: null,
          },
        };
      }
      // Handle GitHub and tarball URLs
      if (isTarballUrl(info.version)) {
        return { name, info, tarballMeta: { tarballUrl: info.version } };
      }
      const gh = await parseGithubSpec(info.version);
      if (gh) {
        return { name, info, tarballMeta: gh };
      }
      // Check if this is an npm alias
      let packageNameForTarball = name;
      if (info._alias && info._realPackage) {
        packageNameForTarball = info._realPackage;
      }
      const tarballMeta = await getTarballUrl(packageNameForTarball, info.version);
      return { name, info, tarballMeta };
    }),
  );

  async function worker({ name, info, tarballMeta }) {
    bar.update(i, { pkg: chalk.yellow(name) });
    // Handle file: and link: dependencies
    if (!tarballMeta.tarballUrl) {
      await handleLocalDep(name, info.version, nodeModulesDir);
      i++;
      bar.update(i, { pkg: chalk.yellow(name) });
      return;
    }
    // Only handle GitHub/tarball install if info.version is a GitHub/tarball spec.
    // Both `gh` and `isGithubOrTarball` are derived cheaply from `tarballMeta`
    // (which the resolution phase already populated), so we avoid a redundant
    // parseGithubSpec(info.version) call here — that would otherwise trigger
    // a second GitHub API request per GitHub spec and burn rate-limit budget.
    const gh = (tarballMeta && tarballMeta.user && tarballMeta.name)
      ? tarballMeta
      : null;
    const isGithubOrTarball = !!tarballMeta.tarballUrl && (
      isTarballUrl(tarballMeta.tarballUrl) ||
      tarballMeta.tarballUrl.includes('codeload.github.com')
    );
    if (isGithubOrTarball) {
      // Tertiary safety: validate cheaply using the already-parsed `gh`
      // (no extra GitHub API call). The outer condition already established
      // the spec is valid via `tarballMeta`, but this preserves the original
      // error message for any unforeseen edge cases.
      if (!(await validateGithubOrTarballSpec(info.version, gh))) {
        console.error(chalk.red(`Invalid GitHub/tarball spec: '${info.version}'.\nExamples: user/repo, user/repo#branch, github:user/repo#sha, https://example.com/pkg.tgz`));
        throw new Error(`Invalid GitHub/tarball spec: ${info.version}`);
      }
      const safeName = sanitizePackageDirName(name);
      const dest = path.join(nodeModulesDir, safeName);
      await safeRemove(dest);
      await fs.mkdir(dest, { recursive: true });
      await fs.mkdir(TARBALL_CACHE_DIR, { recursive: true });
      // Auth context (shared across all candidate attempts and the direct
      // tarball path — branch choice doesn't affect auth headers).
      let headers = {};
      let useSSH = false;
      if (tarballMeta.tarballUrl.includes('codeload.github.com')) {
        const auth = await getGitHubAuthHeaders();
        if (auth.useSSH) {
          useSSH = true;
        } else if (auth.Authorization) {
          headers = auth;
        }
      }

      const crypto = require("crypto");

      // We only enter the multi-branch fallback loop when this is a real
      // GitHub spec (parseGithubSpec populated refCandidates + user/name).
      // For raw tarball URLs (info.version = https://.../*.tgz) the
      // tarballUrl IS the source of truth and refCandidates/user/name are
      // absent — we must NOT overwrite it with a candidate-built URL.
      const isGithubSpec =
        !!tarballMeta.user &&
        !!tarballMeta.name &&
        Array.isArray(tarballMeta.refCandidates) &&
        tarballMeta.refCandidates.length > 0;

      let tarballPath = null;
      let usedCache = false;

      // Helper: drop a partial / zero-byte cache file left behind by an
      // earlier failed download so the next attempt doesn't treat it as a
      // valid cache hit.
      const dropStalePartial = async (p) => {
        try {
          const st = await fs.stat(p);
          if (st.size === 0) await fs.unlink(p);
        } catch {}
      };

      if (isGithubSpec) {
        // GitHub spec — try each candidate branch in priority order and stop
        // at the first one that succeeds. HTTP 404 (and SSH clone failures,
        // see below) are treated as "branch missing" and trigger the next
        // candidate (issue #11: many repos like apache-superset/superset-
        // frontend still default to 'master').
        const candidates = tarballMeta.refCandidates;
        const explicitPinned = !!tarballMeta.explicitPinned;
        let downloaded = false;
        let lastErr = null;

        for (const candidateRef of candidates) {
          const candidateTarballUrl =
            `https://codeload.github.com/${tarballMeta.user}/${tarballMeta.name}/tar.gz/${candidateRef}`;
          const candidateUrlHash =
            crypto.createHash("sha1").update(candidateTarballUrl).digest("hex");
          const candidateTarballPath =
            path.join(TARBALL_CACHE_DIR, `${name}-${candidateUrlHash}.tar.gz`);

          // Cache check: only treat non-empty files as hits; drop stale
          // partial files from a prior failed download before proceeding.
          await dropStalePartial(candidateTarballPath);
          if (await fs.stat(candidateTarballPath).then(() => true, () => false)) {
            tarballPath = candidateTarballPath;
            tarballMeta.ref = candidateRef;
            tarballMeta.tarballUrl = candidateTarballUrl;
            usedCache = true;
            downloaded = true;
            break;
          }

          try {
            if (useSSH && tarballMeta.sshUrl) {
              // Use SSH to clone and create tarball
              await downloadWithSSH(tarballMeta.sshUrl, candidateRef, candidateTarballPath, isVerbose);
            } else {
              await downloadWithRetry(candidateTarballUrl, candidateTarballPath, headers, 3);
            }
            tarballPath = candidateTarballPath;
            tarballMeta.ref = candidateRef;
            tarballMeta.tarballUrl = candidateTarballUrl;
            usedCache = false;
            downloaded = true;
            if (!explicitPinned && candidates.length > 1) {
              console.log(chalk.cyan(
                `[${name}] Resolved default branch for ${info.version}: ${candidateRef}`
              ));
            }
            break;
          } catch (err) {
            lastErr = err;
            // Clean up any partial tarball before continuing/rethrowing.
            await fs.unlink(candidateTarballPath).catch(() => {});
            if (useSSH) {
              // The git CLI doesn't surface a parseable "branch missing" error
              // through the current spawn wiring, so for SSH we fall through
              // to the next candidate on any failure when one is available,
              // then rethrow the last error if all candidates are exhausted.
              if (candidates.length > 1) {
                console.warn(chalk.yellow(
                  `[${name}] SSH attempt for ref '${candidateRef}' failed, trying next candidate.`
                ));
                continue;
              }
              throw err;
            }
            const is404 = err.response && err.response.status === 404;
            if (is404 && candidates.length > 1) {
              console.warn(chalk.yellow(
                `[${name}] Ref '${candidateRef}' not found, trying next candidate.`
              ));
              continue;
            }
            if (tarballMeta.tarballUrl.includes('codeload.github.com')) {
              if (!process.env.GITHUB_TOKEN) {
                console.error(chalk.red(`Failed to download from GitHub. For private repos, either:`));
                console.error(chalk.red(`  1. Set GITHUB_TOKEN env var with a personal access token, or`));
                console.error(chalk.red(`  2. Add your SSH key with 'ssh-add' for SSH authentication`));
              }
            }
            if (err.response && (err.response.status === 403 || err.response.status === 404)) {
              console.error(chalk.red(`HTTP ${err.response.status} for ${candidateTarballUrl}. Check repo access or token.`));
            }
            throw err;
          }
        }

        if (!downloaded) {
          throw lastErr || new Error(
            `Could not resolve a valid branch for ${info.version}`
          );
        }
      } else {
        // Raw tarball URL (or other non-GitHub-spec path). Single direct
        // download — preserves today's behaviour for `blaze install https://.../*.tgz`.
        const directUrl = tarballMeta.tarballUrl;
        const directHash =
          crypto.createHash("sha1").update(directUrl).digest("hex");
        const directTarballPath =
          path.join(TARBALL_CACHE_DIR, `${name}-${directHash}.tar.gz`);

        await dropStalePartial(directTarballPath);
        if (await fs.stat(directTarballPath).then(() => true, () => false)) {
          tarballPath = directTarballPath;
          usedCache = true;
        } else {
          try {
            if (useSSH && tarballMeta.sshUrl) {
              await downloadWithSSH(tarballMeta.sshUrl, tarballMeta.ref, directTarballPath, isVerbose);
            } else {
              await downloadWithRetry(directUrl, directTarballPath, headers, 3);
            }
            tarballPath = directTarballPath;
            usedCache = false;
          } catch (err) {
            await fs.unlink(directTarballPath).catch(() => {});
            if (directUrl.includes('codeload.github.com')) {
              if (!process.env.GITHUB_TOKEN) {
                console.error(chalk.red(`Failed to download from GitHub. For private repos, either:`));
                console.error(chalk.red(`  1. Set GITHUB_TOKEN env var with a personal access token, or`));
                console.error(chalk.red(`  2. Add your SSH key with 'ssh-add' for SSH authentication`));
              }
            }
            if (err.response && (err.response.status === 403 || err.response.status === 404)) {
              console.error(chalk.red(`HTTP ${err.response.status} for ${directUrl}. Check repo access or token.`));
            }
            throw err;
          }
        }
      }
      // Extract. Drop the on-disk tarball on extract failure so the next
      // run doesn't treat a corrupted/half-extracted package as a cache hit
      // and silently ship a broken node_modules entry.
      const tar = require("tar");
      try {
        await tar.x({ file: tarballPath, C: dest, strip: 1 });
      } catch (err) {
        await fs.unlink(tarballPath).catch(() => {});
        console.error(chalk.red(`Failed to extract tarball: ${tarballPath}\n${err.message}`));
        throw err;
      }
      if (isVerbose) {
        console.log(chalk.cyan(`Installed ${name} from ${tarballMeta.tarballUrl}${usedCache ? " (from cache)" : ""}`));
      }
      i++;
      bar.update(i, { pkg: chalk.yellow(name) });
      return;
    }
    const storePath = await ensureInStore(name, info.version, tarballMeta);
    const linkPath = path.join(nodeModulesDir, name);
    // Check if already installed and up-to-date
    const installedPkgJson = path.join(linkPath, "package.json");
    let skip = false;
    try {
      const data = await fs.readFile(installedPkgJson, "utf-8");
      const pkg = JSON.parse(data);
      if (pkg.version === info.version) {
        skip = true;
      }
    } catch {}
    if (skip) {
      // Already installed and up-to-date
      i++;
      bar.update(i, { pkg: chalk.yellow(name) });
      return;
    }
    await safeRemove(linkPath);
    const t0 = process.hrtime.bigint();
    if (options.useSymlinks) {
      try {
        await fs.symlink(storePath, linkPath, "dir");
      } catch (err) {
        console.warn(chalk.yellow(`⚠ Symlink failed for ${name}@${info.version} (${err.code || err.message}). Falling back to copy. This will be much slower!`));
        await fs.cp(storePath, linkPath, { recursive: true });
      }
    } else {
      await fs.cp(storePath, linkPath, { recursive: true });
    }
    const t1 = process.hrtime.bigint();
    if (isVerbose) {
      const linkTime = Number(t1 - t0) / 1_000_000; // Convert to milliseconds
      console.log(chalk.gray(`[TIMING] link/copy ${name}@${info.version}: ${linkTime.toFixed(2)}ms`));
    }
    // Run lifecycle scripts
    const t2 = process.hrtime.bigint();
    await runLifecycleScript(linkPath, "preinstall", name);
    await runLifecycleScript(linkPath, "install", name);
    await runLifecycleScript(linkPath, "postinstall", name);
    const t3 = process.hrtime.bigint();
    if (isVerbose) {
      const lifecycleTime = Number(t3 - t2) / 1_000_000; // Convert to milliseconds
      console.log(chalk.gray(`[TIMING] lifecycle ${name}@${info.version}: ${lifecycleTime.toFixed(2)}ms`));
    }
    i++;
    bar.update(i, { pkg: chalk.yellow(name) });
  }

  // Run workers in parallel with concurrency limit
  let idx = 0;
  async function runBatch() {
    const batch = [];
    for (
      let c = 0;
      c < concurrency && idx < pkgsWithTarballs.length;
      c++, idx++
    ) {
      batch.push(worker(pkgsWithTarballs[idx]));
    }
    await Promise.all(batch);
    if (idx < pkgsWithTarballs.length) {
      await runBatch();
    }
  }
  try {
  await runBatch();
  } catch (err) {
    bar && bar.stop();
    console.log(boxen(chalk.red.bold('❌ Install failed!') + '\n' + chalk.gray(err.message), {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'red',
      backgroundColor: 'black',
      align: 'center',
    }));
    process.exit(1);
  }

  bar.stop();
  console.log(boxen(chalk.bold.green('✔ All packages installed!'), {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'green',
    backgroundColor: 'black',
    align: 'center',
  }));
}

module.exports = { installTree, runLifecycleScript };
