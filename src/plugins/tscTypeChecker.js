const { execSync } = require("child_process");

function runTypeCheck() {
  try {
    execSync("npx tsc --noEmit", { stdio: "inherit" });
    console.log("[tscTypeChecker] TypeScript type check passed.");
  } catch (e) {
    console.warn("[tscTypeChecker] TypeScript type check failed.");
  }
}

module.exports = {
  afterInstall: runTypeCheck,
  afterUpdate: runTypeCheck,
};
