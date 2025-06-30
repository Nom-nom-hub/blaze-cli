const { readPackageJson } = require('../../lib/readPackageJson');
const fs = require('fs/promises');
const path = require('path');

// Mock fs module
jest.mock('fs/promises');

describe('readPackageJson', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads package.json successfully', async () => {
    const mockPackageJson = {
      name: 'test-package',
      version: '1.0.0',
      dependencies: { lodash: '^4.17.21' },
      devDependencies: { jest: '^29.0.0' }
    };

    fs.readFile.mockResolvedValue(JSON.stringify(mockPackageJson));

    const result = await readPackageJson();

    expect(fs.readFile).toHaveBeenCalledWith(expect.stringContaining('package.json'), 'utf-8');
    expect(result).toEqual(mockPackageJson);
  });

  it('handles missing dependencies', async () => {
    const mockPackageJson = {
      name: 'test-package',
      version: '1.0.0'
    };

    fs.readFile.mockResolvedValue(JSON.stringify(mockPackageJson));

    const result = await readPackageJson();

    expect(result).toEqual(mockPackageJson);
    expect(result.dependencies).toBeUndefined();
    expect(result.devDependencies).toBeUndefined();
  });

  it('handles empty dependencies', async () => {
    const mockPackageJson = {
      name: 'test-package',
      version: '1.0.0',
      dependencies: {},
      devDependencies: {}
    };

    fs.readFile.mockResolvedValue(JSON.stringify(mockPackageJson));

    const result = await readPackageJson();

    expect(result.dependencies).toEqual({});
    expect(result.devDependencies).toEqual({});
  });

  it('throws error for invalid JSON', async () => {
    fs.readFile.mockResolvedValue('invalid json');

    await expect(readPackageJson()).rejects.toThrow();
  });

  it('throws error when file does not exist', async () => {
    fs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

    await expect(readPackageJson()).rejects.toThrow('ENOENT');
  });

  it('handles package.json with scripts', async () => {
    const mockPackageJson = {
      name: 'test-package',
      version: '1.0.0',
      scripts: {
        test: 'jest',
        build: 'webpack'
      }
    };

    fs.readFile.mockResolvedValue(JSON.stringify(mockPackageJson));

    const result = await readPackageJson();

    expect(result.scripts).toEqual({
      test: 'jest',
      build: 'webpack'
    });
  });

  it('handles package.json with workspaces', async () => {
    const mockPackageJson = {
      name: 'test-package',
      version: '1.0.0',
      workspaces: ['packages/*']
    };

    fs.readFile.mockResolvedValue(JSON.stringify(mockPackageJson));

    const result = await readPackageJson();

    expect(result.workspaces).toEqual(['packages/*']);
  });
}); 