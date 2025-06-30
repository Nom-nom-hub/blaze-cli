const RegistryMirror = require('../../lib/registryMirror');
const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');

// Mock dependencies
jest.mock('axios');
jest.mock('fs/promises');
jest.mock('path');

describe('RegistryMirror', () => {
  let mirror;
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.npm_config_registry = 'https://custom-registry.com/';
    process.env.BLAZE_REGISTRIES = 'https://mirror1.com/,https://mirror2.com/';
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock path.join
    path.join.mockReturnValue('/mock/npmrc/path');
    
    // Mock fs.readFile
    fs.readFile.mockResolvedValue('registry=https://npmrc-registry.com/\n');
    
    // Mock axios
    axios.request.mockResolvedValue({ data: 'success' });

    mirror = new RegistryMirror();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('initializes with registries', () => {
    expect(Array.isArray(mirror.registries)).toBe(true);
  });

  it('selects current registry', () => {
    const reg = mirror.getCurrentRegistry();
    expect(mirror.registries).toContain(reg);
  });

  it('makes GET request with correct method', async () => {
    axios.request.mockResolvedValue({ data: {} });
    await mirror.get('/package/lodash');
    expect(axios.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET' }));
  });

  it('makes POST request with correct method', async () => {
    axios.request.mockResolvedValue({ data: {} });
    await mirror.post('/package', { foo: 'bar' });
    expect(axios.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
  });

  it('handles request failover', async () => {
    axios.request.mockRejectedValueOnce(new Error('fail'));
    axios.request.mockResolvedValueOnce({ data: {} });
    await mirror.request('/package/lodash');
    expect(axios.request).toHaveBeenCalled();
  });

  it('adds registry to failed set on error', async () => {
    axios.request.mockRejectedValue(new Error('fail'));
    const reg = mirror.getCurrentRegistry();
    try {
      await mirror.request('/package/lodash');
    } catch {}
    expect(mirror.failedRegistries.has(reg)).toBe(true);
  });

  it('removes registry from failed set on success', async () => {
    axios.request.mockResolvedValue({ data: {} });
    const reg = mirror.getCurrentRegistry();
    mirror.failedRegistries.add(reg);
    await mirror.request('/package/lodash');
    expect(mirror.failedRegistries.has(reg)).toBe(false);
  });

  it('returns registry status', () => {
    const status = mirror.getRegistryStatus();
    expect(status).toHaveProperty('current');
    expect(status).toHaveProperty('all');
    expect(status).toHaveProperty('failed');
    expect(status).toHaveProperty('healthy');
  });

  describe('constructor', () => {
    it('initializes with default settings', async () => {
      expect(mirror.registries.length).toBeGreaterThan(0);
      expect(mirror.currentIndex).toBe(0);
      expect(mirror.failedRegistries).toBeInstanceOf(Set);
    });
  });

  describe('loadRegistryConfig', () => {
    it('loads registries from environment variables', async () => {
      expect(mirror.registries).toContain('https://custom-registry.com/');
      expect(mirror.registries).toContain('https://mirror1.com/');
      expect(mirror.registries).toContain('https://mirror2.com/');
    });

    it('uses default registry when npm_config_registry is not set', async () => {
      delete process.env.npm_config_registry;
      mirror = new RegistryMirror();
      expect(mirror.registries).toContain('https://registry.npmjs.org/');
    });

    it('loads registries from .npmrc file', async () => {
      expect(fs.readFile).toHaveBeenCalledWith('/mock/npmrc/path', 'utf-8');
      expect(mirror.registries).toContain('https://npmrc-registry.com/');
    });

    it('handles .npmrc file read errors gracefully', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));
      
      mirror = new RegistryMirror();
      expect(mirror.registries).toContain('https://custom-registry.com/');
      expect(mirror.registries).toContain('https://mirror1.com/');
      expect(mirror.registries).toContain('https://mirror2.com/');
    });

    it('handles empty BLAZE_REGISTRIES environment variable', async () => {
      delete process.env.BLAZE_REGISTRIES;
      
      mirror = new RegistryMirror();
      
      expect(mirror.registries).toContain('https://custom-registry.com/');
    });
  });

  describe('request', () => {
    it('makes successful request to first registry', async () => {
      const response = await mirror.request('/package/lodash');
      
      expect(axios.request).toHaveBeenCalledWith({
        url: expect.stringContaining('/package/lodash'),
        timeout: 10000
      });
      expect(response).toEqual({ data: 'success' });
    });

    it('retries with next registry when first fails', async () => {
      axios.request
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: 'success' });

      const response = await mirror.request('/package/lodash');
      
      expect(axios.request).toHaveBeenCalledTimes(2);
      expect(response).toEqual({ data: 'success' });
    });

    it('throws error when all registries fail', async () => {
      axios.request.mockRejectedValue(new Error('Network error'));

      await expect(mirror.request('/package/lodash')).rejects.toThrow('All registries failed');
    });

    it('handles full URLs correctly', async () => {
      await mirror.request('https://full-url.com/package');
      
      expect(axios.request).toHaveBeenCalledWith({
        url: 'https://full-url.com/package',
        timeout: 10000
      });
    });

    it('passes through custom options', async () => {
      const customOptions = { headers: { 'Authorization': 'Bearer token' } };
      
      await mirror.request('/package/lodash', customOptions);
      
      expect(axios.request).toHaveBeenCalledWith({
        url: expect.stringContaining('/package/lodash'),
        timeout: 10000,
        headers: { 'Authorization': 'Bearer token' }
      });
    });
  });

  describe('get', () => {
    it('makes GET request with correct method', async () => {
      await mirror.get('/package/lodash');
      
      expect(axios.request).toHaveBeenCalledWith({
        url: expect.stringContaining('/package/lodash'),
        method: 'GET',
        timeout: 10000
      });
    });
  });

  describe('post', () => {
    it('makes POST request with data and correct method', async () => {
      const data = { name: 'test-package' };
      
      await mirror.post('/package', data);
      
      expect(axios.request).toHaveBeenCalledWith({
        url: expect.stringContaining('/package'),
        method: 'POST',
        data: { name: 'test-package' },
        timeout: 10000
      });
    });
  });

  describe('getCurrentRegistry', () => {
    it('returns current registry', () => {
      const currentRegistry = mirror.getCurrentRegistry();
      expect(mirror.registries).toContain(currentRegistry);
    });
  });

  describe('getRegistryStatus', () => {
    it('returns registry status information', () => {
      const status = mirror.getRegistryStatus();
      
      expect(status).toHaveProperty('current');
      expect(status).toHaveProperty('all');
      expect(status).toHaveProperty('failed');
      expect(status).toHaveProperty('healthy');
      
      expect(status.current).toBe(mirror.getCurrentRegistry());
      expect(status.all).toEqual(mirror.registries);
      expect(status.failed).toEqual(Array.from(mirror.failedRegistries));
      expect(status.healthy).toEqual(mirror.registries.filter(r => !mirror.failedRegistries.has(r)));
    });

    it('correctly identifies failed and healthy registries', async () => {
      // Simulate a failed registry
      const firstRegistry = mirror.getCurrentRegistry();
      mirror.failedRegistries.add(firstRegistry);
      
      const status = mirror.getRegistryStatus();
      
      expect(status.failed).toContain(firstRegistry);
      expect(status.healthy).not.toContain(firstRegistry);
    });
  });
}); 