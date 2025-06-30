const { ensureInStore, computeTarballSHA1, computeTarballSHA512Base64 } = require('../../lib/downloadAndExtract');
const fs = require('fs/promises');
const crypto = require('crypto');

// Mock fs module
jest.mock('fs/promises');

// Mock crypto module
jest.mock('crypto');

// Mock registry service
jest.mock('../../lib/registryService', () => ({
  getPackageMetadata: jest.fn().mockResolvedValue({
    versions: {
      '4.17.21': {
        dist: {
          tarball: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
          integrity: 'sha512-test'
        }
      }
    }
  }),
  getPackageVersion: jest.fn().mockResolvedValue({
    dist: {
      tarball: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
      integrity: 'sha512-test'
    }
  })
}));

describe('downloadAndExtract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureInStore', () => {
    it('returns existing store path when package.json exists', async () => {
      fs.access.mockResolvedValue(undefined);
      fs.mkdir.mockResolvedValue(undefined);

      const result = await ensureInStore('lodash', '4.17.21', {
        tarballUrl: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz'
      });

      expect(result).toContain('lodash');
      expect(result).toContain('4.17.21');
    });

    it('downloads and extracts when package not in store', async () => {
      // Mock fs.access to fail for package.json but succeed for other operations
      fs.access.mockImplementation((path) => {
        if (path.includes('package.json')) {
          throw new Error('ENOENT');
        }
        return Promise.resolve();
      });
      fs.mkdir.mockResolvedValue(undefined);
      fs.writeFile.mockResolvedValue(undefined);

      // Mock crypto
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('mock-digest')
      };
      crypto.createHash.mockReturnValue(mockHash);

      // Mock axios to prevent actual downloads
      const axios = require('axios');
      const mockAxios = jest.spyOn(axios, 'get');
      mockAxios.mockResolvedValue({
        data: {
          pipe: jest.fn().mockReturnThis(),
          on: jest.fn().mockImplementation(function(event, callback) {
            if (event === 'data') {
              callback(Buffer.from('fake tarball data'));
            }
            if (event === 'end') {
              callback();
            }
            return this;
          })
        }
      });

      // Mock tar extraction
      const tar = require('tar');
      jest.spyOn(tar, 'x').mockResolvedValue(undefined);

      const result = await ensureInStore('lodash', '4.17.21', {
        tarballUrl: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz'
      });

      expect(result).toContain('lodash');
      expect(result).toContain('4.17.21');
      expect(fs.mkdir).toHaveBeenCalled();
      
      mockAxios.mockRestore();
      tar.x.mockRestore();
    }, 10000);

    it('handles integrity verification failure', async () => {
      fs.access.mockImplementation((path) => {
        if (path.includes('package.json')) {
          throw new Error('ENOENT');
        }
        return Promise.resolve();
      });
      fs.mkdir.mockResolvedValue(undefined);
      fs.writeFile.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue(Buffer.from('invalid data'));

      // Mock crypto
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('invalid-hash')
      };
      crypto.createHash.mockReturnValue(mockHash);

      // Mock axios to return invalid data
      const axios = require('axios');
      const mockAxios = jest.spyOn(axios, 'get');
      mockAxios.mockResolvedValue({
        data: {
          pipe: jest.fn().mockReturnThis(),
          on: jest.fn().mockImplementation(function(event, callback) {
            if (event === 'data') {
              callback(Buffer.from('invalid data'));
            }
            if (event === 'end') {
              callback();
            }
            return this;
          })
        }
      });

      await expect(ensureInStore('lodash', '4.17.21', {
        tarballUrl: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
        integrity: 'sha512-wrong-hash'
      })).rejects.toThrow('Package hash/integrity verification failed!');
      
      mockAxios.mockRestore();
    });
  });

  describe('computeTarballSHA1', () => {
    it('computes SHA1 hash of file', async () => {
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('abc123')
      };
      crypto.createHash.mockReturnValue(mockHash);
      fs.readFile.mockResolvedValue(Buffer.from('test data'));

      const result = await computeTarballSHA1('/test/path');

      expect(result).toBe('abc123');
      expect(crypto.createHash).toHaveBeenCalledWith('sha1');
      expect(fs.readFile).toHaveBeenCalledWith('/test/path');
    });

    it('handles file read error', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT'));

      await expect(computeTarballSHA1('/test/path')).rejects.toThrow('ENOENT');
    });
  });

  describe('computeTarballSHA512Base64', () => {
    it('computes SHA512 base64 hash of file', async () => {
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('base64hash')
      };
      crypto.createHash.mockReturnValue(mockHash);
      fs.readFile.mockResolvedValue(Buffer.from('test data'));

      const result = await computeTarballSHA512Base64('/test/path');

      expect(result).toBe('base64hash');
      expect(crypto.createHash).toHaveBeenCalledWith('sha512');
      expect(fs.readFile).toHaveBeenCalledWith('/test/path');
    });

    it('handles file read error', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT'));

      await expect(computeTarballSHA512Base64('/test/path')).rejects.toThrow('ENOENT');
    });
  });
}); 