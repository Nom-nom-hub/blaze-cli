const { writeLockfile } = require('../../lib/writeLockfile');
const fs = require('fs/promises');

// Mock fs module
jest.mock('fs/promises');

describe('writeLockfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes lockfile successfully', async () => {
    const mockLockfile = {
      lodash: {
        version: '4.17.21',
        resolved: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
        integrity: 'sha512-t2DMzyJIOO2ryVNvR8ezCiGJOJ2yfpd0fVDLX5e0yfXBYzOszaiU0odx8eRX8fP9udPUdt3TP/SUX/O6JpQULCQ=='
      }
    };

    fs.writeFile.mockResolvedValue(undefined);

    await writeLockfile(mockLockfile);

    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('blaze-lock.json'),
      expect.stringContaining('"version": "2.0.0"'),
      'utf-8'
    );
  });

  it('handles empty lockfile', async () => {
    const mockLockfile = {};

    fs.writeFile.mockResolvedValue(undefined);

    await writeLockfile(mockLockfile);

    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('blaze-lock.json'),
      expect.stringContaining('"packages": {}'),
      'utf-8'
    );
  });

  it('handles lockfile with version strings', async () => {
    const mockLockfile = {
      lodash: '4.17.21',
      'cli-progress': '3.12.0'
    };

    fs.writeFile.mockResolvedValue(undefined);

    await writeLockfile(mockLockfile);

    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('blaze-lock.json'),
      expect.stringContaining('"totalPackages": 2'),
      'utf-8'
    );
  });

  it('throws error when write fails', async () => {
    const mockLockfile = { lodash: '4.17.21' };
    const writeError = new Error('EACCES: permission denied');

    fs.writeFile.mockRejectedValue(writeError);

    await expect(writeLockfile(mockLockfile)).rejects.toThrow('EACCES');
  });

  it('handles complex nested lockfile structure', async () => {
    const mockLockfile = {
      lodash: {
        version: '4.17.21',
        resolved: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
        integrity: 'sha512-...',
        dependencies: {
          'some-dep': '1.0.0'
        }
      }
    };

    fs.writeFile.mockResolvedValue(undefined);

    await writeLockfile(mockLockfile);

    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('blaze-lock.json'),
      expect.stringContaining('"some-dep": "1.0.0"'),
      'utf-8'
    );
  });

  it('handles null input', async () => {
    fs.writeFile.mockResolvedValue(undefined);

    await writeLockfile(null);

    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('blaze-lock.json'),
      expect.stringContaining('"totalPackages": 0'),
      'utf-8'
    );
  });
}); 