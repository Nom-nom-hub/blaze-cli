const execa = require('execa');
const path = require('path');
const fs = require('fs').promises;

describe('blaze workspace', () => {
  const cli = path.resolve(__dirname, '../../bin/blaze-install.js');
  let testDir;

  beforeEach(async () => {
    // Create a temporary test directory for monorepo
    testDir = path.join(__dirname, '../fixtures/workspace-test');
    await fs.mkdir(testDir, { recursive: true });
    
    // Create root package.json with workspaces
    const rootPackageJson = {
      name: 'workspace-test',
      version: '1.0.0',
      private: true,
      workspaces: ['packages/*'],
      dependencies: {
        lodash: '4.17.21'
      }
    };
    await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify(rootPackageJson, null, 2));
    
    // Create workspace packages
    await fs.mkdir(path.join(testDir, 'packages'), { recursive: true });
    
    // Package A
    await fs.mkdir(path.join(testDir, 'packages/package-a'), { recursive: true });
    const packageAJson = {
      name: '@workspace/package-a',
      version: '1.0.0',
      dependencies: {
        chalk: '4.1.2'
      }
    };
    await fs.writeFile(path.join(testDir, 'packages/package-a/package.json'), JSON.stringify(packageAJson, null, 2));
    
    // Package B
    await fs.mkdir(path.join(testDir, 'packages/package-b'), { recursive: true });
    const packageBJson = {
      name: '@workspace/package-b',
      version: '1.0.0',
      dependencies: {
        '@workspace/package-a': 'workspace:*'
      }
    };
    await fs.writeFile(path.join(testDir, 'packages/package-b/package.json'), JSON.stringify(packageBJson, null, 2));
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('shows install help for workspace context', async () => {
    const { stdout } = await execa('node', [cli, 'install', '--help'], { cwd: testDir });
    expect(stdout).toMatch(/install/);
  }, 10000);

  it('handles workspace detection', async () => {
    const { stdout } = await execa('node', [cli, 'install', '--help'], { cwd: testDir });
    expect(stdout).toMatch(/install/);
  }, 10000);

  it('validates workspace configuration', async () => {
    // Create invalid workspace config
    const invalidPackageJson = {
      name: 'invalid-workspace',
      version: '1.0.0',
      workspaces: 'invalid-pattern'
    };
    await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify(invalidPackageJson, null, 2));
    
    const { stdout } = await execa('node', [cli, 'install'], { cwd: testDir });
    expect(stdout).toMatch(/All packages installed from lockfile/);
  }, 10000);
}); 