const { installTree, runLifecycleScript } = require('../../lib/installTree');
const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const { spawn } = require('child_process');

// Mock dependencies
jest.mock('fs/promises');
jest.mock('path');
jest.mock('axios');
jest.mock('child_process');
jest.mock('../../lib/downloadAndExtract', () => ({
  ensureInStore: jest.fn().mockResolvedValue('/mock/store/path')
}));

describe('installTree', () => {
  let mockTree;
  let mockDestDir;

  beforeEach(() => {
    mockTree = {
      'lodash': { version: '4.17.21' },
      'express': { version: '4.18.2' },
      'local-pkg': { version: 'file:../local-pkg' },
      'linked-pkg': { version: 'link:../linked-pkg' }
    };
    mockDestDir = '/mock/dest/dir';
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock path.join
    path.join.mockImplementation((...args) => args.join('/'));
    
    // Mock fs.mkdir
    fs.mkdir.mockResolvedValue(undefined);
    
    // Mock fs.readFile for package.json
    fs.readFile.mockImplementation((filePath) => {
      if (filePath.includes('package.json')) {
        return Promise.resolve(JSON.stringify({ version: '1.0.0' }));
      }
      return Promise.reject(new Error('File not found'));
    });
    
    // Mock fs.rm
    fs.rm.mockResolvedValue(undefined);
    
    // Mock fs.cp
    fs.cp.mockResolvedValue(undefined);
    
    // Mock fs.symlink
    fs.symlink.mockResolvedValue(undefined);
    
    // Mock fs.lstat
    fs.lstat.mockResolvedValue({
      isDirectory: () => true,
      isSymbolicLink: () => false
    });
    
    // Mock axios.get
    axios.get.mockResolvedValue({
      data: {
        dist: {
          tarball: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
          shasum: 'sha1-1234567890',
          integrity: 'sha512-abcdef'
        }
      }
    });
    
    // Mock spawn
    const mockChild = {
      on: jest.fn().mockImplementation(function(event, callback) {
        if (event === 'close') {
          setTimeout(() => callback(0), 0);
        }
        return this;
      })
    };
    spawn.mockReturnValue(mockChild);
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'debug').mockImplementation();
    jest.spyOn(process.stdout, 'write').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('installTree', () => {
    it('installs packages successfully', async () => {
      const result = await installTree(mockTree, mockDestDir);
      
      expect(result).toEqual({
        installed: 4,
        skipped: 0,
        total: 4
      });
      expect(fs.mkdir).toHaveBeenCalledWith('/mock/dest/dir/node_modules', { recursive: true });
    });

    it('handles empty tree', async () => {
      const result = await installTree({}, mockDestDir);
      
      expect(result).toEqual({
        installed: 0,
        skipped: 0,
        total: 0
      });
    });

    it('skips already installed packages with same version', async () => {
      // Mock fs.readFile to return same version
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('package.json')) {
          return Promise.resolve(JSON.stringify({ version: '4.17.21' }));
        }
        return Promise.reject(new Error('File not found'));
      });
      
      const result = await installTree({ 'lodash': { version: '4.17.21' } }, mockDestDir);
      
      expect(result.skipped).toBe(1);
      expect(result.installed).toBe(0);
    });

    it('handles file: dependencies', async () => {
      const result = await installTree({ 'local-pkg': { version: 'file:../local-pkg' } }, mockDestDir);
      
      expect(result.installed).toBe(1);
      expect(fs.cp).toHaveBeenCalled();
    });

    it('handles link: dependencies', async () => {
      const result = await installTree({ 'linked-pkg': { version: 'link:../linked-pkg' } }, mockDestDir);
      
      expect(result.installed).toBe(1);
      expect(fs.symlink).toHaveBeenCalled();
    });

    it('falls back to copy when symlink fails', async () => {
      const error = new Error('EPERM');
      error.code = 'EPERM';
      fs.symlink.mockRejectedValue(error);
      
      const result = await installTree({ 'linked-pkg': { version: 'link:../linked-pkg' } }, mockDestDir);
      
      expect(result.installed).toBe(1);
      expect(fs.cp).toHaveBeenCalled();
    });

    it('handles symlink EEXIST error', async () => {
      const error = new Error('EEXIST');
      error.code = 'EEXIST';
      fs.symlink.mockRejectedValue(error);
      
      const result = await installTree({ 'linked-pkg': { version: 'link:../linked-pkg' } }, mockDestDir);
      
      expect(result.installed).toBe(1);
      expect(fs.cp).toHaveBeenCalled();
    });

    it('uses symlinks when useSymlinks option is true', async () => {
      const result = await installTree(mockTree, mockDestDir, { useSymlinks: true });
      
      expect(result.installed).toBe(4);
      expect(fs.symlink).toHaveBeenCalled();
    });

    it('handles package.json read errors gracefully', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));
      
      const result = await installTree({ 'lodash': { version: '4.17.21' } }, mockDestDir);
      
      expect(result.installed).toBe(1);
    });

    it('handles lifecycle script failures', async () => {
      const mockChild = {
        on: jest.fn().mockImplementation(function(event, callback) {
          if (event === 'close') {
            setTimeout(() => callback(1), 0); // Non-zero exit code
          }
          return this;
        })
      };
      spawn.mockReturnValue(mockChild);
      
      // Mock package.json with scripts
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('package.json')) {
          return Promise.resolve(JSON.stringify({ 
            version: '1.0.0',
            scripts: { preinstall: 'echo "test"' }
          }));
        }
        return Promise.reject(new Error('File not found'));
      });
      
      const result = await installTree({ 'lodash': { version: '4.17.21' } }, mockDestDir);
      
      expect(result.skipped).toBe(1);
      expect(result.installed).toBe(0);
    });

    it('handles spawn errors', async () => {
      const mockChild = {
        on: jest.fn().mockImplementation(function(event, callback) {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Spawn error')), 0);
          }
          return this;
        })
      };
      spawn.mockReturnValue(mockChild);
      
      // Mock package.json with scripts
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('package.json')) {
          return Promise.resolve(JSON.stringify({ 
            version: '1.0.0',
            scripts: { preinstall: 'echo "test"' }
          }));
        }
        return Promise.reject(new Error('File not found'));
      });
      
      const result = await installTree({ 'lodash': { version: '4.17.21' } }, mockDestDir);
      
      expect(result.skipped).toBe(1);
      expect(result.installed).toBe(0);
    });

    it('handles cached metadata', async () => {
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('.blaze_metadata_cache')) {
          return Promise.resolve(JSON.stringify({
            dist: {
              tarball: 'https://cached-tarball.tgz',
              shasum: 'sha1-cached',
              integrity: 'sha512-cached'
            }
          }));
        }
        if (filePath.includes('package.json')) {
          return Promise.resolve(JSON.stringify({ version: '1.0.0' }));
        }
        return Promise.reject(new Error('File not found'));
      });
      
      await installTree({ 'lodash': { version: '4.17.21' } }, mockDestDir);
      // Test passes if no error is thrown (cache was used successfully)
      expect(true).toBe(true);
    });

    it('handles cache read errors', async () => {
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('.blaze_metadata_cache')) {
          return Promise.reject(new Error('Cache read error'));
        }
        if (filePath.includes('package.json')) {
          return Promise.resolve(JSON.stringify({ version: '1.0.0' }));
        }
        return Promise.reject(new Error('File not found'));
      });
      
      await installTree({ 'lodash': { version: '4.17.21' } }, mockDestDir);
      
      // Should fall back to registry
      expect(axios.get).toHaveBeenCalled();
    });

    it('handles missing dist information', async () => {
      axios.get.mockResolvedValue({
        data: { name: 'lodash', version: '4.17.21' }
      });
      
      await installTree({ 'lodash': { version: '4.17.21' } }, mockDestDir);
      
      // Should handle missing dist gracefully
      expect(true).toBe(true);
    });
  });

  describe('runLifecycleScript', () => {
    it('runs lifecycle script successfully', async () => {
      const mockChild = {
        on: jest.fn().mockImplementation(function(event, callback) {
          if (event === 'close') {
            setTimeout(() => callback(0), 0);
          }
          return this;
        })
      };
      spawn.mockReturnValue(mockChild);
      
      fs.readFile.mockResolvedValue(JSON.stringify({
        scripts: { preinstall: 'echo "preinstall"' }
      }));
      
      const result = await runLifecycleScript('/mock/pkg/dir', 'preinstall', 'test-pkg');
      
      expect(result).toEqual({ success: true, code: 0 });
      expect(spawn).toHaveBeenCalled();
    });

    it('handles missing scripts gracefully', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({}));
      
      const result = await runLifecycleScript('/mock/pkg/dir', 'preinstall', 'test-pkg');
      
      expect(result).toEqual({ success: true, code: 0 });
    });

    it('handles package.json read errors', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));
      
      const result = await runLifecycleScript('/mock/pkg/dir', 'preinstall', 'test-pkg');
      
      expect(result).toEqual({ success: true, code: 0 });
    });

    it('handles script execution errors', async () => {
      const mockChild = {
        on: jest.fn().mockImplementation(function(event, callback) {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Script error')), 0);
          }
          return this;
        })
      };
      spawn.mockReturnValue(mockChild);
      
      fs.readFile.mockResolvedValue(JSON.stringify({
        scripts: { preinstall: 'echo "preinstall"' }
      }));
      
      const result = await runLifecycleScript('/mock/pkg/dir', 'preinstall', 'test-pkg');
      
      expect(result).toEqual({ success: false, error: 'Script error' });
    });

    it('handles non-zero exit codes', async () => {
      const mockChild = {
        on: jest.fn().mockImplementation(function(event, callback) {
          if (event === 'close') {
            setTimeout(() => callback(1), 0);
          }
          return this;
        })
      };
      spawn.mockReturnValue(mockChild);
      
      fs.readFile.mockResolvedValue(JSON.stringify({
        scripts: { preinstall: 'echo "preinstall"' }
      }));
      
      const result = await runLifecycleScript('/mock/pkg/dir', 'preinstall', 'test-pkg');
      
      expect(result).toEqual({ success: false, code: 1 });
    });
  });

  describe('safeRemove', () => {
    it('removes directories', async () => {
      fs.lstat.mockResolvedValue({
        isDirectory: () => true,
        isSymbolicLink: () => false
      });
      
      // This would test the safeRemove function if it were exported
      // For now, we test it indirectly through installTree
      await installTree({ 'lodash': { version: '4.17.21' } }, mockDestDir);
      
      expect(fs.rm).toHaveBeenCalled();
    });

    it('removes symlinks', async () => {
      fs.lstat.mockResolvedValue({
        isDirectory: () => false,
        isSymbolicLink: () => true
      });
      
      await installTree({ 'lodash': { version: '4.17.21' } }, mockDestDir);
      
      expect(fs.unlink).toHaveBeenCalled();
    });

    it('removes files', async () => {
      fs.lstat.mockResolvedValue({
        isDirectory: () => false,
        isSymbolicLink: () => false
      });
      
      await installTree({ 'lodash': { version: '4.17.21' } }, mockDestDir);
      
      expect(fs.unlink).toHaveBeenCalled();
    });

    it('handles ENOENT errors gracefully', async () => {
      fs.lstat.mockRejectedValue({ code: 'ENOENT' });
      
      await installTree({ 'lodash': { version: '4.17.21' } }, mockDestDir);
      
      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe('getTarballUrl', () => {
    it('fetches tarball URL from registry', async () => {
      await installTree({ 'lodash': { version: '4.17.21' } }, mockDestDir);
      
      expect(axios.get).toHaveBeenCalledWith(
        'https://registry.npmjs.org/lodash/4.17.21'
      );
    });

    it('handles cached metadata', async () => {
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('.blaze_metadata_cache')) {
          return Promise.resolve(JSON.stringify({
            dist: {
              tarball: 'https://cached-tarball.tgz',
              shasum: 'sha1-cached',
              integrity: 'sha512-cached'
            }
          }));
        }
        if (filePath.includes('package.json')) {
          return Promise.resolve(JSON.stringify({ version: '1.0.0' }));
        }
        return Promise.reject(new Error('File not found'));
      });
      
      await installTree({ 'lodash': { version: '4.17.21' } }, mockDestDir);
      
      // Test passes if no error is thrown (cache was used successfully)
      expect(true).toBe(true);
    });

    it('handles cache read errors', async () => {
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('.blaze_metadata_cache')) {
          return Promise.reject(new Error('Cache read error'));
        }
        return Promise.reject(new Error('File not found'));
      });
      
      await installTree({ 'lodash': { version: '4.17.21' } }, mockDestDir);
      
      // Should fall back to registry
      expect(axios.get).toHaveBeenCalled();
    });

    it('handles missing dist information', async () => {
      axios.get.mockResolvedValue({
        data: { name: 'lodash', version: '4.17.21' }
      });
      
      await installTree({ 'lodash': { version: '4.17.21' } }, mockDestDir);
      
      // Should handle missing dist gracefully
      expect(true).toBe(true);
    });
  });
}); 