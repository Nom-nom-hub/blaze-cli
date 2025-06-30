const { 
  prefetchPackages, 
  isPrefetched, 
  getPrefetchStats, 
  clearPrefetchCache, 
  getPrefetchPath,
  prefetchAll 
} = require('../../lib/prefetch');
const fs = require('fs/promises');

// Mock fs module
jest.mock('fs/promises');

describe('prefetch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('prefetchPackages', () => {
    it('prefetches packages successfully', async () => {
      const packages = [
        { name: 'lodash', version: '4.17.21' },
        { name: 'react', version: '18.2.0' }
      ];
      const mockProgress = jest.fn();

      fs.mkdir.mockResolvedValue(undefined);
      fs.writeFile.mockResolvedValue(undefined);

      const result = await prefetchPackages(packages, { progress: mockProgress });

      expect(result).toBeDefined();
      expect(fs.mkdir).toHaveBeenCalled();
      expect(mockProgress).toHaveBeenCalled();
    });

    it('handles empty package list', async () => {
      const result = await prefetchPackages([], {});

      expect(result).toEqual([]);
    });

    it('handles prefetch errors gracefully', async () => {
      const packages = [{ name: 'nonexistent-package', version: '1.0.0' }];
      fs.mkdir.mockRejectedValue(new Error('Permission denied'));

      const result = await prefetchPackages(packages, {});

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('reports progress correctly', async () => {
      const packages = [
        { name: 'lodash', version: '4.17.21' },
        { name: 'react', version: '18.2.0' }
      ];
      const mockProgress = jest.fn();

      fs.mkdir.mockResolvedValue(undefined);
      fs.writeFile.mockResolvedValue(undefined);

      await prefetchPackages(packages, { progress: mockProgress });

      expect(mockProgress).toHaveBeenCalledWith(expect.objectContaining({
        current: expect.any(Number),
        total: expect.any(Number)
      }));
    });
  });

  describe('isPrefetched', () => {
    it('returns true for prefetched packages', async () => {
      const packageName = 'lodash';
      const version = '4.17.21';

      fs.access.mockResolvedValue(undefined);

      const result = await isPrefetched(packageName, version);

      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalledWith(
        expect.stringContaining(`${packageName}-${version}.json`),
        expect.any(Number)
      );
    });

    it('returns false for non-prefetched packages', async () => {
      const packageName = 'nonexistent';
      const version = '1.0.0';

      fs.access.mockRejectedValue(new Error('ENOENT'));

      const result = await isPrefetched(packageName, version);

      expect(result).toBe(false);
    });

    it('handles access errors', async () => {
      const packageName = 'lodash';
      const version = '4.17.21';

      fs.access.mockRejectedValue(new Error('Permission denied'));

      const result = await isPrefetched(packageName, version);

      expect(result).toBe(false);
    });
  });

  describe('getPrefetchStats', () => {
    it('returns prefetch statistics', async () => {
      const mockFiles = [
        'lodash-4.17.21.json',
        'react-18.2.0.json',
        'react-dom-18.2.0.json'
      ];

      fs.readdir.mockResolvedValue(mockFiles);
      fs.stat.mockResolvedValue({ size: 1024 });

      const stats = await getPrefetchStats();

      expect(stats).toHaveProperty('totalPackages');
      expect(stats).toHaveProperty('totalSize');
      expect(stats.totalPackages).toBe(3);
      expect(stats.totalSize).toBe(3072); // 3 * 1024
    });

    it('handles empty prefetch directory', async () => {
      fs.readdir.mockResolvedValue([]);

      const stats = await getPrefetchStats();

      expect(stats.totalPackages).toBe(0);
      expect(stats.totalSize).toBe(0);
    });

    it('handles readdir errors', async () => {
      fs.readdir.mockRejectedValue(new Error('Permission denied'));

      const stats = await getPrefetchStats();

      expect(stats.totalPackages).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });

  describe('clearPrefetchCache', () => {
    it('clears prefetch cache successfully', async () => {
      const mockFiles = ['lodash-4.17.21.json', 'react-18.2.0.json'];
      fs.readdir.mockResolvedValue(mockFiles);
      fs.rm.mockResolvedValue(undefined);

      const result = await clearPrefetchCache();

      expect(result).toBe(true);
      expect(fs.rm).toHaveBeenCalledTimes(2);
    });

    it('handles empty cache', async () => {
      fs.readdir.mockResolvedValue([]);

      const result = await clearPrefetchCache();

      expect(result).toBe(true);
      expect(fs.rm).not.toHaveBeenCalled();
    });

    it('handles clear errors', async () => {
      fs.readdir.mockRejectedValue(new Error('Permission denied'));

      const result = await clearPrefetchCache();

      expect(result).toBe(false);
    });
  });

  describe('getPrefetchPath', () => {
    it('returns correct prefetch path', () => {
      const packageName = 'lodash';
      const version = '4.17.21';

      const prefetchPath = getPrefetchPath(packageName, version);

      expect(prefetchPath).toContain('lodash');
      expect(prefetchPath).toContain('4.17.21');
    });

    it('handles scoped packages', () => {
      const packageName = '@scope/package';
      const version = '1.0.0';

      const prefetchPath = getPrefetchPath(packageName, version);

      expect(prefetchPath).toContain('scope_package');
      expect(prefetchPath).toContain('1.0.0');
    });
  });
});

describe('prefetchAll', () => {
  it('should prefetch all dependencies without error', async () => {
    await expect(prefetchAll({})).resolves.toBeUndefined();
  });
}); 