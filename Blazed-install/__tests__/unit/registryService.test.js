const registryService = require('../../lib/registryService');
const axios = require('axios');

// Mock axios
jest.mock('axios');

describe('registryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPackageMetadata', () => {
    it('fetches package metadata successfully', async () => {
      const mockResponse = {
        data: {
          name: 'lodash',
          'dist-tags': {
            latest: '4.17.21'
          },
          versions: {
            '4.17.21': {
              name: 'lodash',
              version: '4.17.21',
              dist: {
                tarball: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz'
              }
            }
          }
        }
      };

      axios.request.mockResolvedValue(mockResponse);

      const result = await registryService.getPackageMetadata('lodash');

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('lodash'),
          method: 'GET'
        })
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('handles scoped packages', async () => {
      const mockResponse = {
        data: {
          name: '@scope/package',
          'dist-tags': { latest: '1.0.0' },
          versions: { '1.0.0': { name: '@scope/package', version: '1.0.0' } }
        }
      };

      axios.request.mockResolvedValue(mockResponse);

      await registryService.getPackageMetadata('@scope/package');

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('@scope/package'),
          method: 'GET'
        })
      );
    });

    it('throws error when package not found', async () => {
      axios.request.mockRejectedValue({
        response: { status: 404, data: { error: 'Not found' } }
      });

      await expect(registryService.getPackageMetadata('nonexistent')).rejects.toThrow();
    });

    it('throws error on network failure', async () => {
      axios.request.mockRejectedValue(new Error('Network error'));

      await expect(registryService.getPackageMetadata('lodash')).rejects.toThrow('Network error');
    });
  });

  describe('audit', () => {
    it('performs security audit successfully', async () => {
      const mockResponse = {
        data: {
          metadata: {
            vulnerabilities: { total: 0 }
          },
          advisories: {}
        }
      };

      axios.request.mockResolvedValue(mockResponse);

      const payload = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: { lodash: { version: '4.17.21' } }
      };

      const result = await registryService.audit(payload);

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/-/npm/v1/security/audits'),
          method: 'POST',
          data: payload,
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('handles audit with vulnerabilities', async () => {
      const mockResponse = {
        data: {
          metadata: {
            vulnerabilities: { total: 2 }
          },
          advisories: {
            '1': {
              module_name: 'vulnerable-package',
              severity: 'high',
              title: 'Security vulnerability',
              url: 'https://example.com/advisory',
              vulnerable_versions: '<=1.0.0',
              findings: [{ version: '1.0.0' }]
            }
          }
        }
      };

      axios.request.mockResolvedValue(mockResponse);

      const payload = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: { 'vulnerable-package': { version: '1.0.0' } }
      };

      const result = await registryService.audit(payload);

      expect(result.metadata.vulnerabilities.total).toBe(2);
      expect(result.advisories).toHaveProperty('1');
    });

    it('throws error when audit fails', async () => {
      axios.request.mockRejectedValue(new Error('Audit failed'));

      const payload = { name: 'test', version: '1.0.0', dependencies: {} };

      await expect(registryService.audit(payload)).rejects.toThrow('Audit failed');
    });

    it('handles audit with no vulnerabilities', async () => {
      const mockResponse = {
        data: {
          metadata: {
            vulnerabilities: { total: 0 }
          },
          advisories: {}
        }
      };

      axios.request.mockResolvedValue(mockResponse);

      const payload = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {}
      };

      const result = await registryService.audit(payload);

      expect(result.metadata.vulnerabilities.total).toBe(0);
    });
  });

  describe('downloadPackage', () => {
    it('downloads package successfully', async () => {
      const mockResponse = {
        data: Buffer.from('package data'),
        headers: { 'content-type': 'application/octet-stream' }
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await registryService.downloadPackage('https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz');

      expect(axios.get).toHaveBeenCalledWith(
        'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
        expect.objectContaining({
          responseType: 'arraybuffer'
        })
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('throws error when download fails', async () => {
      axios.get.mockRejectedValue(new Error('Download failed'));

      await expect(registryService.downloadPackage('https://example.com/package.tgz')).rejects.toThrow('Download failed');
    });
  });

  it('should have getPackageMetadata, getPackageVersion, audit, and getCurrentRegistry methods', () => {
    expect(typeof registryService.getPackageMetadata).toBe('function');
    expect(typeof registryService.getPackageVersion).toBe('function');
    expect(typeof registryService.audit).toBe('function');
    expect(typeof registryService.getCurrentRegistry).toBe('function');
  });
}); 