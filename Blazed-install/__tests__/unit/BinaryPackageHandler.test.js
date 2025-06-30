const { BinaryPackageHandler } = require('../../lib/BinaryPackageHandler');
const fs = require('fs/promises');
const path = require('path');

// Mock fs module
jest.mock('fs/promises');

describe('BinaryPackageHandler', () => {
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new BinaryPackageHandler();
  });

  describe('installBinaries', () => {
    it('installs binaries successfully', async () => {
      const mockPackage = {
        name: 'test-package',
        bin: {
          'test-binary': './bin/test.js'
        }
      };

      fs.mkdir.mockResolvedValue(undefined);
      fs.copyFile.mockResolvedValue(undefined);
      fs.chmod.mockResolvedValue(undefined);

      await handler.installBinaries(mockPackage, '/test/package', '/test/node_modules');

      expect(fs.mkdir).toHaveBeenCalledWith(path.normalize('/test/node_modules/.bin'), { recursive: true });
      expect(fs.copyFile).toHaveBeenCalled();
      expect(fs.chmod).toHaveBeenCalled();
    });

    it('handles package with string bin', async () => {
      const mockPackage = {
        name: 'test-package',
        bin: './bin/test.js'
      };

      fs.mkdir.mockResolvedValue(undefined);
      fs.copyFile.mockResolvedValue(undefined);
      fs.chmod.mockResolvedValue(undefined);

      await handler.installBinaries(mockPackage, '/test/package', '/test/node_modules');

      expect(fs.mkdir).toHaveBeenCalledWith(path.normalize('/test/node_modules/.bin'), { recursive: true });
      expect(fs.copyFile).toHaveBeenCalled();
    });

    it('handles package without bin', async () => {
      const mockPackage = {
        name: 'test-package'
      };

      await handler.installBinaries(mockPackage, '/test/package', '/test/node_modules');

      expect(fs.mkdir).not.toHaveBeenCalled();
      expect(fs.copyFile).not.toHaveBeenCalled();
    });

    it('handles mkdir failure', async () => {
      const mockPackage = {
        name: 'test-package',
        bin: { 'test-binary': './bin/test.js' }
      };

      fs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(handler.installBinaries(mockPackage, '/test/package', '/test/node_modules')).rejects.toThrow('Permission denied');
    });

    it('handles copy file failure', async () => {
      const mockPackage = {
        name: 'test-package',
        bin: { 'test-binary': './bin/test.js' }
      };

      fs.mkdir.mockResolvedValue(undefined);
      fs.copyFile.mockRejectedValue(new Error('File not found'));

      await expect(handler.installBinaries(mockPackage, '/test/package', '/test/node_modules')).rejects.toThrow('File not found');
    });
  });

  describe('createBinaryScript', () => {
    it('creates binary script with shebang', async () => {
      const script = handler.createBinaryScript('/test/bin/script.js');

      expect(script).toContain('#!/usr/bin/env node');
      expect(script).toContain('require(\'/test/bin/script.js\')');
    });

    it('handles different script paths', async () => {
      const script = handler.createBinaryScript('./bin/cli.js');

      expect(script).toContain('require(\'./bin/cli.js\')');
    });
  });

  describe('getBinaryPath', () => {
    it('returns correct binary path for Windows', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      const binaryPath = handler.getBinaryPath('test-binary', '/test/node_modules');

      expect(binaryPath).toContain('test-binary.cmd');

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });

    it('returns correct binary path for Unix', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      const binaryPath = handler.getBinaryPath('test-binary', '/test/node_modules');

      expect(binaryPath).toContain('test-binary');

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });
  });

  describe('validateBinary', () => {
    it('validates existing binary file', async () => {
      fs.access.mockResolvedValue(undefined);

      const result = await handler.validateBinary('/test/bin/script.js');

      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalledWith('/test/bin/script.js', fs.constants.F_OK);
    });

    it('returns false for non-existent binary', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT'));

      const result = await handler.validateBinary('/test/bin/nonexistent.js');

      expect(result).toBe(false);
    });

    it('handles access error', async () => {
      fs.access.mockRejectedValue(new Error('Permission denied'));

      const result = await handler.validateBinary('/test/bin/script.js');

      expect(result).toBe(false);
    });
  });

  describe('handleBinaryPackage', () => {
    it('returns success for package with no postinstall', async () => {
      jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValueOnce(JSON.stringify({}));
      const result = await handler.handleBinaryPackage('/fake/dir', 'test-package');
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('message', 'No postinstall script found');
    });
    it('returns error if package.json cannot be read', async () => {
      jest.spyOn(require('fs/promises'), 'readFile').mockRejectedValueOnce(new Error('fail'));
      const result = await handler.handleBinaryPackage('/fake/dir', 'test-package');
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
    });
  });

  describe('runPostinstallScript', () => {
    it('resolves with success for code 0', async () => {
      const mockOn = jest.fn(function(event, cb) {
        if (event === 'close') {
          setTimeout(() => cb(0), 10);
        }
        return this;
      });
      jest.spyOn(require('child_process'), 'spawn').mockReturnValue({
        on: mockOn,
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() }
      });
      const result = await handler.runPostinstallScript('.', 'echo hello');
      expect(result).toHaveProperty('success');
    });
  });
}); 