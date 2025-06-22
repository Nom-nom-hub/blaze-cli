const fs = require('fs/promises');
const path = require('path');

async function readLockfile() {
  const lockPath = path.resolve(process.cwd(), 'blaze-lock.json');
  try {
    const data = await fs.readFile(lockPath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

module.exports = { readLockfile }; 