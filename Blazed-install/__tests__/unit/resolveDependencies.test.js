const { resolveDependencies, getCurrentPlatform } = require('../../lib/resolveDependencies');
const registryService = require('../../lib/registryService');

// Mock registryService
jest.mock('../../lib/registryService', () => ({
  getPackageMetadata: jest.fn().mockResolvedValue({
    'dist-tags': { latest: '4.17.21' },
    versions: {
      '4.17.21': {
        name: 'lodash',
        version: '4.17.21',
        dependencies: {}
      }
    }
  })
}));

describe('resolveDependencies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves a simple dependency tree', async () => {
    const deps = { lodash: '^4.17.21' };
    const result = await resolveDependencies(deps, {}, null, [], [], {});
    expect(result.tree).toHaveProperty('lodash');
  }, 10000);

  it('handles empty dependencies', async () => {
    const result = await resolveDependencies({}, {}, null, [], [], {});
    expect(result.tree).toEqual({});
  });

  it('resolves nested dependencies', async () => {
    const deps = { 'cli-progress': '^3.12.0' };
    const result = await resolveDependencies(deps, {}, null, [], [], {});
    expect(result.tree).toHaveProperty('cli-progress');
    expect(result.tree['cli-progress']).toHaveProperty('version');
  });

  it('handles peer dependencies', async () => {
    const deps = { 'react': '^18.0.0' };
    const peerDeps = { 'react-dom': '^18.0.0' };
    const result = await resolveDependencies(deps, peerDeps, null, [], [], {});
    expect(result.tree).toHaveProperty('react');
  });

  it('handles optional dependencies', async () => {
    registryService.getPackageMetadata.mockImplementation((name) => {
      if (name === 'optional-package') {
        return Promise.resolve({
          'dist-tags': { latest: '1.0.0' },
          versions: {
            '1.0.0': {
              name: 'optional-package',
              version: '1.0.0',
              dependencies: {},
              dist: { tarball: 'http://example.com/optional-package.tgz', integrity: 'sha512-abc' }
            }
          }
        });
      }
      // fallback for other packages
      return Promise.resolve({ 'dist-tags': { latest: '1.0.0' }, versions: { '1.0.0': { name, version: '1.0.0', dependencies: {}, dist: {} } } });
    });
    const deps = { 'optional-package': '^1.0.0' };
    const optionalDeps = { 'optional-package': true };
    const result = await resolveDependencies(deps, {}, null, [], [], optionalDeps);
    expect(result.tree).toHaveProperty('optional-package');
  });

  it('handles workspace dependencies', async () => {
    registryService.getPackageMetadata.mockImplementation((name) => {
      if (name === 'workspace-package') {
        return Promise.resolve({
          'dist-tags': { latest: '1.0.0' },
          versions: {
            '1.0.0': {
              name: 'workspace-package',
              version: '1.0.0',
              dependencies: {},
              dist: { tarball: 'http://example.com/workspace-package.tgz', integrity: 'sha512-xyz' }
            }
          }
        });
      }
      // fallback for other packages
      return Promise.resolve({ 'dist-tags': { latest: '1.0.0' }, versions: { '1.0.0': { name, version: '1.0.0', dependencies: {}, dist: {} } } });
    });
    const deps = { 'workspace-package': 'workspace:*' };
    const workspaces = ['packages/*'];
    const result = await resolveDependencies(deps, {}, null, workspaces, [], {});
    expect(result.tree).toHaveProperty('workspace-package');
  });
});

describe('getCurrentPlatform', () => {
  it('returns the current platform', () => {
    const platform = getCurrentPlatform();
    expect(platform).toBeDefined();
    expect(typeof platform).toBe('object');
    expect(platform).toHaveProperty('platform');
    expect(platform).toHaveProperty('arch');
  });

  it('returns a valid platform string', () => {
    const platform = getCurrentPlatform();
    const validPlatforms = ['win32', 'darwin', 'linux', 'freebsd', 'openbsd', 'sunos', 'aix'];
    expect(validPlatforms).toContain(platform.platform);
  });
}); 