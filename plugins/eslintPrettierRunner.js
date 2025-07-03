const { execSync } = require('child_process');

function runLinters() {
  try {
    execSync('npx eslint .', { stdio: 'inherit' });
    console.log('[eslintPrettierRunner] ESLint passed.');
  } catch (e) {
    console.warn('[eslintPrettierRunner] ESLint failed.');
  }
  try {
    execSync('npx prettier --check .', { stdio: 'inherit' });
    console.log('[eslintPrettierRunner] Prettier check passed.');
  } catch (e) {
    console.warn('[eslintPrettierRunner] Prettier check failed.');
  }
}

module.exports = {
  afterInstall: runLinters,
  afterUpdate: runLinters,
}; 