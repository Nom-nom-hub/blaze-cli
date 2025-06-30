const { readLockfile } = require('../../lib/readLockfile');
const fs = require('fs/promises');
const path = require('path');

// Mock fs module
jest.mock('fs/promises');

describe('readLockfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads lockfile successfully', async () => {
    const mockLockfile = {
      version: '2.0.0',
      packages: {
        'lodash': { version: '4.17.21' }
      }
    };

    fs.readFile.mockResolvedValue(JSON.stringify(mockLockfile));

    const result = await readLockfile();

    expect(fs.readFile).toHaveBeenCalledWith(expect.stringContaining('blaze-lock.json'), 'utf8');
    expect(result).toEqual(mockLockfile.packages);
  });

  it('returns null when lockfile does not exist', async () => {
    const error = new Error('ENOENT: no such file or directory');
    error.code = 'ENOENT';
    fs.readFile.mockRejectedValue(error);

    const result = await readLockfile();

    expect(result).toBeNull();
  });

  it('throws error for other file system errors', async () => {
    fs.readFile.mockRejectedValue(new Error('Permission denied'));

    await expect(readLockfile()).rejects.toThrow('Permission denied');
  });

  it('returns raw data when raw=true', async () => {
    const mockData = '{"test": "data"}';
    fs.readFile.mockResolvedValue(mockData);

    const result = await readLockfile(true);

    expect(result).toBe(mockData);
  });
}); 