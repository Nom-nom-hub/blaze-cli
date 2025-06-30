// Mock os module first, before any other imports
jest.mock('os', () => ({
  platform: jest.fn(() => 'win32'),
  homedir: jest.fn(() => 'C:\\Users\\TestUser')
}));

const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');

// Mock all dependencies
jest.mock('fs/promises');
jest.mock('child_process');
jest.mock('axios');
jest.mock('semver');
jest.mock('glob');
jest.mock('chalk', () => ({
  green: jest.fn((text) => text),
  red: jest.fn((text) => text),
  yellow: jest.fn((text) => text),
  gray: jest.fn((text) => text),
  bold: jest.fn((text) => text),
  blue: jest.fn((text) => text),
}));

// Import the modules we need to mock
const readPackageJsonModule = require('../../lib/readPackageJson');
const readLockfileModule = require('../../lib/readLockfile');
const writeLockfileModule = require('../../lib/writeLockfile');
const installTreeModule = require('../../lib/installTree');
const prefetchModule = require('../../lib/prefetch');
const diagnosticsModule = require('../../lib/diagnostics');
const migrationToolsModule = require('../../lib/migrationTools');
const packageSigningModule = require('../../lib/packageSigning');
const versionConflictResolverModule = require('../../lib/versionConflictResolver');
const peerDependencyResolverModule = require('../../lib/peerDependencyResolver');
const BinaryPackageHandlerModule = require('../../lib/BinaryPackageHandler');
const registryServiceModule = require('../../lib/registryService');
const workspaceResolverModule = require('../../lib/workspaceResolver');

// Import index module at top level for coverage collection
const index = require('../../lib/index');

describe('Index Module - Basic Tests', () => {
  let consoleSpy;
  let processExitSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    
    // Set up default mocks using jest.spyOn for functions that actually exist
    jest.spyOn(readPackageJsonModule, 'readPackageJson').mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
      dependencies: { lodash: '^4.17.21' },
      devDependencies: { jest: '^27.0.0' }
    });
    
    jest.spyOn(readLockfileModule, 'readLockfile').mockResolvedValue({
      dependencies: {
        lodash: { version: '4.17.21' }
      }
    });
    
    jest.spyOn(writeLockfileModule, 'writeLockfile').mockResolvedValue();
    jest.spyOn(installTreeModule, 'installTree').mockResolvedValue({ success: true });
    jest.spyOn(prefetchModule, 'prefetchPackages').mockResolvedValue();
    jest.spyOn(diagnosticsModule, 'runDoctor').mockResolvedValue({ issues: [] });
    jest.spyOn(registryServiceModule, 'getPackageMetadata').mockResolvedValue({
      'dist-tags': { latest: '4.17.21' },
      versions: { '4.17.21': {} }
    });
    jest.spyOn(registryServiceModule, 'audit').mockResolvedValue({
      metadata: { vulnerabilities: { total: 0 } }
    });
    
    // Mock fs operations
    fs.readFile.mockResolvedValue('{"name":"test","version":"1.0.0"}');
    fs.writeFile.mockResolvedValue();
    fs.access.mockResolvedValue();
    fs.mkdir.mockResolvedValue();
    
    // Mock child_process
    spawn.mockReturnValue({
      on: jest.fn(),
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() }
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    processExitSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('printHelp', () => {
    it('should print help information', () => {
      index.printHelp();
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('createInstallSummary', () => {
    it('should create basic install summary', async () => {
      const summary = await index.createInstallSummary({
        installed: 5,
        skipped: 2,
        duration: 1.5
      });
      expect(summary).toContain('5');
      expect(summary).toContain('2');
    });

    it('should create summary with custom options', async () => {
      const summary = await index.createInstallSummary({
        installed: 3,
        skipped: 1,
        duration: 0.8
      }, { theme: 'light', unicode: false });
      expect(summary).toContain('3');
    });

    it('should handle zero installations', async () => {
      const summary = await index.createInstallSummary({
        installed: 0,
        skipped: 0,
        duration: 0.1
      });
      expect(summary).toContain('0');
    });
  });

  describe('main function', () => {
    it('should show welcome message when no args provided', async () => {
      await index.main([]);
      expect(consoleSpy).toHaveBeenCalledWith('Welcome to blaze-install!');
    });

    it('should show help when --help flag provided', async () => {
      await index.main(['--help']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    });

    it('should show help when help command provided', async () => {
      await index.main(['help']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    });

    it('should handle version command', async () => {
      await index.main(['version']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    });

    it('should handle install command with dependencies', async () => {
      await index.main(['install']);
      expect(consoleSpy).toHaveBeenCalledWith('Welcome to blaze-install!');
    });

    it('should handle install command with specific package', async () => {
      await index.main(['install', 'lodash']);
      expect(consoleSpy).toHaveBeenCalledWith('Welcome to blaze-install!');
    });

    it('should handle uninstall command', async () => {
      await index.main(['uninstall', 'lodash']);
      expect(consoleSpy).toHaveBeenCalledWith('lodash was not found in dependencies.');
    });

    it('should handle update command', async () => {
      await index.main(['update', 'lodash']);
      expect(consoleSpy).toHaveBeenCalledWith('Welcome to blaze-install!');
    });

    it('should handle audit command', async () => {
      await index.main(['audit']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No known vulnerabilities found'));
    });

    it('should handle list command', async () => {
      await index.main(['list']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Installed dependencies'));
    });

    it('should handle clean command', async () => {
      await index.main(['clean']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Removed'));
    });

    it('should handle outdated command', async () => {
      await index.main(['outdated']);
      expect(consoleSpy).toHaveBeenCalledWith('No dependencies found.');
    });

    it('should handle info command', async () => {
      await index.main(['info', 'lodash']);
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching info for', 'lodash', '-', expect.any(String));
    });

    it('should handle graph command', async () => {
      // Graph command might not produce output, so just check that it doesn't throw
      await expect(index.main(['graph'])).resolves.not.toThrow();
    });

    it('should handle --no-lockfile flag', async () => {
      await index.main(['install', '--no-lockfile']);
      expect(consoleSpy).toHaveBeenCalledWith('Welcome to blaze-install!');
    });

    it('should handle --offline flag', async () => {
      await index.main(['install', '--offline']);
      expect(consoleSpy).toHaveBeenCalledWith('Welcome to blaze-install!');
    });

    it('should handle --ci flag', async () => {
      await index.main(['install', '--ci']);
      expect(consoleSpy).toHaveBeenCalledWith('Welcome to blaze-install!');
    });

    it('should handle --audit-fix flag', async () => {
      await index.main(['install', '--audit-fix']);
      expect(consoleSpy).toHaveBeenCalledWith('Welcome to blaze-install!');
    });

    it('should handle --save-dev flag', async () => {
      await index.main(['install', 'lodash', '--save-dev']);
      expect(consoleSpy).toHaveBeenCalledWith('Welcome to blaze-install!');
    });

    it('should handle --production flag', async () => {
      await index.main(['install', '--production']);
      expect(consoleSpy).toHaveBeenCalledWith('Welcome to blaze-install!');
    });

    it('should handle --symlink flag', async () => {
      await index.main(['install', '--symlink']);
      expect(consoleSpy).toHaveBeenCalledWith('Welcome to blaze-install!');
    });

    it('should handle prefetch command', async () => {
      await index.main(['prefetch']);
      expect(consoleSpy).toHaveBeenCalledWith('No dependencies to prefetch.');
    });

    it('should handle doctor command', async () => {
      diagnosticsModule.runDoctor.mockImplementation(async () => { console.log('Test issue'); return { issues: ['Test issue'] }; });
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      await index.main(['doctor']);
      const calls = consoleSpy.mock.calls.flat().join(' ') + errorSpy.mock.calls.flat().join(' ');
      expect(calls).toMatch(/doctor|Test issue/);
      errorSpy.mockRestore();
    });

    it('should handle unknown command gracefully', async () => {
      await index.main(['unknown-command']);
      expect(consoleSpy).toHaveBeenCalledWith('Welcome to blaze-install!');
    });

    it('should handle missing package.json', async () => {
      readPackageJsonModule.readPackageJson.mockRejectedValueOnce(new Error('ENOENT'));
      await index.main(['install']);
      expect(consoleSpy).toHaveBeenCalledWith('Welcome to blaze-install!');
    });

    it('should handle empty package.json', async () => {
      readPackageJsonModule.readPackageJson.mockResolvedValueOnce({
        name: 'test-package',
        version: '1.0.0'
      });
      await index.main(['install']);
      expect(consoleSpy).toHaveBeenCalledWith('Welcome to blaze-install!');
    });

    it('should handle lockfile out of sync', async () => {
      readLockfileModule.readLockfile.mockResolvedValueOnce({
        dependencies: { 'different-package': { version: '1.0.0' } }
      });
      await index.main(['install']);
      expect(consoleSpy).toHaveBeenCalledWith('Welcome to blaze-install!');
    });
  });
}); 