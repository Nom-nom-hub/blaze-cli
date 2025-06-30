const execa = require('execa');
const path = require('path');
const fs = require('fs').promises;

describe('blaze enterprise commands', () => {
  const cli = path.resolve(__dirname, '../../bin/blaze-install.js');
  let testDir;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(__dirname, '../fixtures/enterprise-test');
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('migrate', () => {
    it('shows migrate help', async () => {
      const { stdout } = await execa('node', [cli, 'migrate', '--help']);
      expect(stdout).toMatch(/migrate/);
    }, 10000);
  });

  describe('validate', () => {
    it('shows validate help', async () => {
      const { stdout } = await execa('node', [cli, 'validate', '--help']);
      expect(stdout).toMatch(/validate/);
    }, 10000);
  });

  describe('profile', () => {
    it('shows profile help', async () => {
      const { stdout } = await execa('node', [cli, 'profile', '--help']);
      expect(stdout).toMatch(/profile/);
    }, 10000);
  });

  describe('registry', () => {
    it('shows registry help', async () => {
      const { stdout } = await execa('node', [cli, 'registry', '--help']);
      expect(stdout).toMatch(/registry/);
    }, 10000);
  });

  describe('signing', () => {
    it('shows signing help', async () => {
      const { stdout } = await execa('node', [cli, 'signing', '--help']);
      expect(stdout).toMatch(/signing/);
    }, 10000);
  });
}); 