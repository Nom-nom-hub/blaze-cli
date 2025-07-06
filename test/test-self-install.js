#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Testing blaze-install self-install issue...\n');

// Helper function for assertions
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`❌ Assertion failed: ${message}`);
    console.error(`  Expected: ${expected}`);
    console.error(`  Actual:   ${actual}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

// Helper function to get package version from package.json
function getPackageVersion(pkgPath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version;
  } catch (error) {
    return null;
  }
}

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
  process.exit(1);
}

// Check what npm installed
if (fs.existsSync('node_modules/blaze-install/package.json')) {
  const npmBlazePkg = JSON.parse(fs.readFileSync('node_modules/blaze-install/package.json', 'utf8'));
  console.log('4. npm installed blaze-install version:', npmBlazePkg.version);
  assertEqual(npmBlazePkg.version, '1.11.7', 'npm should install blaze-install@1.11.7');
} else {
  console.error('❌ npm did not install blaze-install');
  process.exit(1);
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
  // Use dynamic path resolution for CLI
  const cliPath = path.resolve(__dirname, '../bin/blaze-install.js');
  execSync(`node ${cliPath} install`, { stdio: 'inherit' });
  console.log('✅ blaze install completed');
} catch (error) {
  console.log('❌ blaze install failed:', error.message);
  process.exit(1);
}

// Check what blaze installed
if (fs.existsSync('node_modules/blaze-install/package.json')) {
  const blazePkg = JSON.parse(fs.readFileSync('node_modules/blaze-install/package.json', 'utf8'));
  console.log('7. blaze installed blaze-install version:', blazePkg.version);
  assertEqual(blazePkg.version, '1.11.7', 'blaze should install blaze-install@1.11.7 (no downgrade)');
} else {
  console.error('❌ blaze did not install blaze-install');
  process.exit(1);
}

// Check lockfile
if (fs.existsSync('blaze-lock.json')) {
  const lockfile = JSON.parse(fs.readFileSync('blaze-lock.json', 'utf8'));
  console.log('8. blaze-lock.json shows blaze-install version:', lockfile['blaze-install']?.version);
  assertEqual(lockfile['blaze-install']?.version, '1.11.7', 'blaze-lock.json should show blaze-install@1.11.7');
} else {
  console.error('❌ blaze-lock.json not found');
  process.exit(1);
}

// Test npm alias support
console.log('\n9. Testing npm alias support...');
const aliasPackageJson = {
  name: "test-npm-aliases",
  version: "1.0.0",
  dependencies: {
    "string-width-cjs": "npm:string-width@^4.2.0"
  }
};

const aliasTestDir = path.join(__dirname, 'test-npm-aliases');
if (fs.existsSync(aliasTestDir)) {
  fs.rmSync(aliasTestDir, { recursive: true, force: true });
}
fs.mkdirSync(aliasTestDir, { recursive: true });

fs.writeFileSync(path.join(aliasTestDir, 'package.json'), JSON.stringify(aliasPackageJson, null, 2));

try {
  // Use dynamic path resolution for CLI
  const cliPath = path.resolve(__dirname, '../bin/blaze-install.js');
  execSync(`node ${cliPath} install`, { cwd: aliasTestDir, stdio: 'inherit' });
  console.log('✅ npm alias install completed');
  
  // Check that the alias was resolved correctly
  if (fs.existsSync(path.join(aliasTestDir, 'node_modules/string-width-cjs/package.json'))) {
    const aliasPkg = JSON.parse(fs.readFileSync(path.join(aliasTestDir, 'node_modules/string-width-cjs/package.json'), 'utf8'));
    console.log('10. npm alias resolved to version:', aliasPkg.version);
    assertEqual(aliasPkg.name, 'string-width', 'alias should resolve to the real package name');
  } else {
    console.error('❌ npm alias not installed correctly');
    process.exit(1);
  }
} catch (error) {
  console.log('❌ npm alias install failed:', error.message);
  process.exit(1);
}

console.log('\n🎉 All tests passed! Self-downgrade bug is fixed and npm aliases work correctly.'); 