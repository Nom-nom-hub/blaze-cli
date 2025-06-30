const execa = require('execa');
const path = require('path');
const fs = require('fs').promises;

describe('blaze audit', () => {
  const cli = path.resolve(__dirname, '../../bin/blaze-install.js');
  let testDir;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(__dirname, '../fixtures/audit-test');
    await fs.mkdir(testDir, { recursive: true });
    
    // Create a package.json
    const packageJson = {
      name: 'audit-test',
      version: '1.0.0',
      dependencies: {
        lodash: '4.17.21'
      }
    };
    await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('shows audit help', async () => {
    const { stdout } = await execa('node', [cli, 'audit', '--help']);
    expect(stdout).toMatch(/audit/);
  }, 10000);

  it('handles missing lockfile gracefully', async () => {
    const { stdout } = await execa('node', [cli, 'audit'], { cwd: testDir });
    expect(stdout).toMatch(/blaze-lock\.json/);
  }, 10000);

  it('shows audit fix help', async () => {
    const { stdout } = await execa('node', [cli, 'audit', 'fix', '--help']);
    expect(stdout).toMatch(/fix/);
  }, 10000);
}); 