const fs = require('fs');
const path = require('path');

async function runDoctor(fix = false) {
  console.log('Running blaze doctor...');
  console.log('DEBUG: runDoctor cwd:', process.cwd());
  // Ensure we are in the directory with package.json
  if (!fs.existsSync('package.json')) {
    const parent = path.dirname(process.cwd());
    if (fs.existsSync(path.join(parent, 'package.json'))) {
      process.chdir(parent);
      console.log('DEBUG: Changed cwd to parent:', process.cwd());
    }
  }
  // Check for missing node_modules
  if (!fs.existsSync('node_modules')) {
    console.log('Warning: node_modules directory is missing.');
    if (fix) {
      console.log('Recreating node_modules...');
      require('child_process').execSync('npm install', { stdio: 'inherit' });
      await new Promise(r => setTimeout(r, 1000)); // Wait 1 second for file system
      console.log('DEBUG: After npm install, cwd:', process.cwd());
      if (!fs.existsSync('node_modules')) {
        fs.mkdirSync('node_modules');
        console.log('DEBUG: Created node_modules manually.');
      }
    } else {
      console.log('Run `blaze install` to recreate it.');
    }
  }
  // Check for lockfile/package.json mismatch
  if (!fs.existsSync('blaze-lock.json')) {
    console.log('Warning: blaze-lock.json is missing.');
    if (fix) {
      console.log('Regenerating blaze-lock.json...');
      require('child_process').execSync('node ./bin/blaze-install.js install', { stdio: 'inherit' });
    } else {
      console.log('Run `blaze install` to generate it.');
    }
  } else {
    try {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
      const lock = JSON.parse(fs.readFileSync('blaze-lock.json', 'utf-8'));
      const pkgDeps = Object.keys(pkg.dependencies || {});
      const lockDeps = Object.keys(lock || {});
      const missingInLock = pkgDeps.filter(dep => !lockDeps.includes(dep));
      if (missingInLock.length > 0) {
        console.log('Warning: Some dependencies in package.json are missing from the lockfile:', missingInLock);
        if (fix) {
          console.log('Regenerating blaze-lock.json...');
          require('child_process').execSync('node ./bin/blaze-install.js install', { stdio: 'inherit' });
        }
      }
    } catch (e) {
      console.log('Error reading package.json or lockfile:', e.message);
    }
  }
  // Check for broken symlinks in node_modules
  if (fs.existsSync('node_modules')) {
    const modules = fs.readdirSync('node_modules');
    for (const mod of modules) {
      const modPath = path.join('node_modules', mod);
      if (fs.lstatSync(modPath).isSymbolicLink()) {
        try {
          fs.readlinkSync(modPath);
        } catch {
          console.log(`Warning: Broken symlink detected: ${modPath}`);
          if (fix) {
            console.log(`Removing broken symlink: ${modPath}`);
            fs.unlinkSync(modPath);
          }
        }
      }
    }
  }
  // Add more rule-based checks and suggestions here as needed
  console.log('blaze doctor completed.');
}

module.exports = { runDoctor }; 