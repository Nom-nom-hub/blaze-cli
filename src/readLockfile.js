const fs = require("fs/promises");
const path = require("path");

async function readLockfile(raw = false) {
  const lockfilePath = path.join(process.cwd(), "blaze-lock.json");
  try {
    const data = await fs.readFile(lockfilePath, "utf-8");
    return raw ? data : JSON.parse(data);
  } catch (err) {
    if (err.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

module.exports = { readLockfile };
