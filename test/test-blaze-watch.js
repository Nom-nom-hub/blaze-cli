#!/usr/bin/env node

/**
 * Test for `blaze watch` - the auto-install-on-change behaviour.
 *
 * The previous version of this test never started a watcher at all. It
 * wrote a file, waited, and then checked whether `node_modules/left-pad`
 * happened to exist - which it did, because the `pkg-b` workspace
 * depends on `left-pad` and it was already installed. The test passed
 * without the watcher ever running.
 *
 * This version actually runs `blaze watch` in an isolated directory:
 *
 *   1. creates a temp project with no dependencies
 *   2. starts `blaze watch` as a real child process
 *   3. waits for it to report that it is watching
 *   4. writes a file that requires a package which is not installed
 *   5. waits for the watcher to install it
 *   6. asserts the package really landed in node_modules
 *   7. also asserts the watcher noticed a second, unrelated file
 *   8. cleans up the child process and the temp directory
 *
 * It fails (non-zero exit) if the package is not installed, and it uses a
 * package name that is not a dependency of this repository, so a stale
 * `node_modules` cannot make it pass by accident.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

// A package that is not a dependency of blaze-cli and not a dependency of
// the pkg-b workspace, so it can only be present if the watcher installed it.
const PROBE_PACKAGE = "left-pad";

// The watcher reacts within a couple of seconds in practice, but the
// install itself goes out to the npm registry, so allow a generous margin
// for a slow network. The failure case still takes this long, which is
// acceptable for a test that only fails when something is genuinely
// broken.
const WATCH_TIMEOUT_MS = 45000;
const POLL_INTERVAL_MS = 500;

const cliPath = path.resolve(__dirname, "..", "bin", "blaze-install.js");

function log(message) {
  console.log(message);
}

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

/**
 * Create an isolated project directory to run the watcher in.
 */
function createProject() {
  const dir = path.join(
    os.tmpdir(),
    `blaze-watch-test-${process.pid}-${Date.now()}`,
  );
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify(
      { name: "blaze-watch-test-project", version: "1.0.0" },
      null,
      2,
    ),
  );
  return dir;
}

/**
 * Wait for a predicate to become true, polling until the timeout.
 */
function waitFor(predicate, timeoutMs) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const tick = () => {
      let value;
      try {
        value = predicate();
      } catch {
        value = false;
      }
      if (value) {
        resolve(true);
        return;
      }
      if (Date.now() > deadline) {
        resolve(false);
        return;
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();
  });
}

async function main() {
  const projectDir = createProject();
  log(`Created isolated project: ${projectDir}`);

  let child = null;
  let output = "";
  let exited = false;
  let exitCode = null;

  try {
    child = spawn(process.execPath, [cliPath, "watch"], {
      cwd: projectDir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const capture = (chunk) => {
      output += chunk.toString();
      // Echo the watcher's output so a failure is easy to diagnose.
      process.stdout.write(chunk);
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);

    child.on("exit", (code) => {
      exited = true;
      exitCode = code;
    });

    // 1. Wait for the watcher to report that it is up.
    log("Waiting for the watcher to start...");
    const started = await waitFor(
      () => output.includes("Watching for new imports/requires"),
      30000,
    );
    if (!started) {
      fail(
        "The watcher never reported that it was watching.\n" +
          `Output so far:\n${output}`,
      );
      return;
    }
    log("✅ Watcher is running");

    // 2. Write a file that requires a package that is not installed.
    const target = path.join(projectDir, "app.js");
    fs.writeFileSync(
      target,
      `const ${PROBE_PACKAGE.replace(/[^a-z0-9]/gi, "_")} = require("${PROBE_PACKAGE}");\n` +
        `console.log(${PROBE_PACKAGE.replace(/[^a-z0-9]/gi, "_")}("watch", 3));\n`,
    );
    log(`Wrote app.js requiring "${PROBE_PACKAGE}"`);

    // 3. The watcher must install it.
    const installedPath = path.join(
      projectDir,
      "node_modules",
      PROBE_PACKAGE,
    );
    const installed = await waitFor(
      () => fs.existsSync(installedPath),
      WATCH_TIMEOUT_MS,
    );

    if (!installed) {
      fail(
        `The watcher did not install "${PROBE_PACKAGE}" within ${WATCH_TIMEOUT_MS / 1000}s.\n` +
          `Output so far:\n${output}`,
      );
      return;
    }
    log(`✅ ${PROBE_PACKAGE} was installed by the watcher`);

    // 4. The installed package must actually be usable, not just present.
    const probe = path.join(projectDir, "probe.js");
    fs.writeFileSync(
      probe,
      `const p = require("${PROBE_PACKAGE}");\n` +
        `if (typeof p !== "function") { throw new Error("not a function"); }\n` +
        `console.log("PROBE_OK:" + p("x", 3));\n`,
    );
    const { execFileSync } = require("child_process");
    let probeOutput = "";
    try {
      probeOutput = execFileSync(process.execPath, [probe], {
        cwd: projectDir,
        encoding: "utf8",
      });
    } catch (err) {
      fail(
        `The installed "${PROBE_PACKAGE}" could not be required.\n` +
          `${err.stdout || ""}${err.stderr || ""}`,
      );
      return;
    }
    if (!probeOutput.includes("PROBE_OK")) {
      fail(
        `The installed "${PROBE_PACKAGE}" did not behave as expected: ${probeOutput}`,
      );
      return;
    }
    log(`✅ The installed package works: ${probeOutput.trim()}`);

    // 5. The watcher must also notice a change in a different file.
    const other = path.join(projectDir, "other.js");
    fs.writeFileSync(other, "console.log('initial');\n");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const before = output.length;
    fs.writeFileSync(other, "console.log('changed');\n");
    const noticed = await waitFor(
      () => output.length > before && output.includes("other.js"),
      30000,
    );
    if (!noticed) {
      fail(
        "The watcher did not report a change in a second file.\n" +
          `Output so far:\n${output}`,
      );
      return;
    }
    log("✅ The watcher noticed a change in a second file");

    if (exited) {
      fail(`The watcher exited unexpectedly with code ${exitCode}.`);
      return;
    }

    log("\n🎉 All blaze watch tests passed!");
  } finally {
    if (child && !exited) {
      // Stop the watcher and wait for it to actually go away, otherwise
      // the test process would keep running with the child's stdio open.
      const stopped = new Promise((resolve) => child.once("exit", resolve));
      child.kill();
      await Promise.race([
        stopped,
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    }
    try {
      fs.rmSync(projectDir, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((err) => {
  console.error("❌ blaze watch test threw:", err);
  process.exitCode = 1;
});
