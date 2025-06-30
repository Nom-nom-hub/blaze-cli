const fs = require('fs/promises');
const path = require('path');

async function readPackageJson() {const pkgPath = path.resolve(process.cwd(), 'package.json');
  const data = await fs.readFile(pkgPath, 'utf-8');
  return JSON.parse(data);
}

module.exports = { readPackageJson }; 