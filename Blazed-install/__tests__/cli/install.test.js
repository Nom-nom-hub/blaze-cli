const execa = require('execa');
const path = require('path');
const fs = require('fs').promises;

describe('blaze install', () => {
  const cli = path.resolve(__dirname, '../../bin/blaze-install.js');
  let testDir;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(__dirname, '../fixtures/test-project');
    await fs.mkdir(testDir, { recursive: true });
    
    // Create a basic package.json
    const packageJson = {
      name: 'test-project',
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

  it('shows help when no command provided', async () => {
    const { stdout } = await execa('node', [cli, '--help']);
    expect(stdout).toMatch(/Blaze Install/);
    expect(stdout).toMatch(/Usage:/);
  }, 10000);

  it('shows install help', async () => {
    const { stdout } = await execa('node', [cli, 'install', '--help']);
    expect(stdout).toMatch(/install/);
  }, 10000);

  it('handles missing package.json gracefully', async () => {
    try {
      await execa('node', [cli, 'install'], { cwd: path.dirname(testDir) });
    } catch (error) {
      expect(error.stderr).toMatch(/package\.json/);
    }
  }, 10000);

  it('validates package.json format', async () => {
    // Create invalid package.json
    await fs.writeFile(path.join(testDir, 'package.json'), 'invalid json');
    
    try {
      await execa('node', [cli, 'install'], { cwd: testDir });
    } catch (error) {
      expect(error.stderr).toMatch(/JSON/);
    }
  }, 10000);
}); 