const { execSync } = require("child_process");
const out = execSync("node bin/blaze-install.js doctor --json", { encoding: "utf8" });
const m = out.match(/\{[\s\S]*\}/);
const parsed = JSON.parse(m[0]);
if (parsed.status !== "ok") throw new Error("doctor json failed");
console.log("test-doctor-json: OK");
