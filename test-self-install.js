#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Testing blaze-install self-install issue...\n');

// Create a temporary directory
const testDir = path.join(__dirname, 'test-self-install');
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true, force: true });
}
fs.mkdirSync(testDir, { recursive: true });

console.log('1. Created test directory:', testDir);

// Change to test directory
process.chdir(testDir);

// Create package.json with blaze-install dependency
const packageJson = {
  name: "test-blaze-self-install",
  version: "1.0.0",
  dependencies: {
    "blaze-install": "1.11.7"
  }
};

fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
console.log('2. Created package.json with blaze-install@1.11.7');

// Install with npm first
console.log('3. Installing with npm...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ npm install completed');
} catch (error) {
  console.log('❌ npm install failed:', error.message);
}

// Check what npm installed
if (fs.existsSync('node_modules/blaze-install/package.json')) {
  const npmBlazePkg = JSON.parse(fs.readFileSync('node_modules/blaze-install/package.json', 'utf8'));
  console.log('4. npm installed blaze-install version:', npmBlazePkg.version);
}

// Remove node_modules and package-lock.json
fs.rmSync('node_modules', { recursive: true, force: true });
if (fs.existsSync('package-lock.json')) {
  fs.unlinkSync('package-lock.json');
}
console.log('5. Cleaned up npm files');

// Install with blaze-install
console.log('6. Installing with blaze-install...');
try {
  execSync('node ../bin/blaze-install.js install', { stdio: 'inherit' });
  console.log('✅ blaze install completed');
} catch (error) {
  console.log('❌ blaze install failed:', error.message);
}

// Check what blaze installed
if (fs.existsSync('node_modules/blaze-install/package.json')) {
  const blazePkg = JSON.parse(fs.readFileSync('node_modules/blaze-install/package.json', 'utf8'));
  console.log('7. blaze installed blaze-install version:', blazePkg.version);
}

// Check lockfile
if (fs.existsSync('blaze-lock.json')) {
  const lockfile = JSON.parse(fs.readFileSync('blaze-lock.json', 'utf8'));
  console.log('8. blaze-lock.json shows blaze-install version:', lockfile['blaze-install']?.version);
}

console.log('\nTest completed. Check the versions above for any discrepancies.'); 