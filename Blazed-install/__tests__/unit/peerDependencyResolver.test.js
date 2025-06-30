const { PeerDependencyResolver } = require('../../lib/peerDependencyResolver');
const resolver = new PeerDependencyResolver();

// Mock axios and fs
jest.mock('axios');
jest.mock('fs/promises');

describe('PeerDependencyResolver', () => {
  let resolver;

  beforeEach(() => {
    jest.clearAllMocks();
    resolver = new PeerDependencyResolver();
  });

  describe('extractPeerRequirements', () => {
    it('extracts peer requirements from warnings', () => {
      const warnings = [
        'Peer dependency missing: react@^18.0.0',
        'Peer dependency missing: react-dom@^18.0.0'
      ];

      const result = resolver.extractPeerRequirements(warnings);

      expect(result).toBeInstanceOf(Map);
      expect(result.has('react')).toBe(true);
      expect(result.has('react-dom')).toBe(true);
    });

    it('handles empty warnings', () => {
      const result = resolver.extractPeerRequirements([]);
      expect(result.size).toBe(0);
    });

    it('ignores non-peer dependency warnings', () => {
      const warnings = [
        'Some other warning',
        'Peer dependency missing: react@^18.0.0'
      ];

      const result = resolver.extractPeerRequirements(warnings);

      expect(result.size).toBe(1);
      expect(result.has('react')).toBe(true);
    });
  });

  describe('resolvePeerDependencies', () => {
    it('resolves peer dependencies successfully', async () => {
      const peerRequirements = new Map();
      peerRequirements.set('react', new Set(['^18.0.0']));
      peerRequirements.set('react-dom', new Set(['^18.0.0']));

      const existingDeps = { 'react': '18.2.0' };

      // Mock fetchPackageMetadata
      resolver.fetchPackageMetadata = jest.fn().mockResolvedValue({
        versions: {
          '18.2.0': {},
          '18.1.0': {},
          '17.0.0': {}
        }
      });

      const result = await resolver.resolvePeerDependencies(peerRequirements, existingDeps);

      expect(result).toHaveProperty('react', '18.2.0');
      expect(result).toHaveProperty('react-dom');
    });

    it('handles empty peer requirements', async () => {
      const result = await resolver.resolvePeerDependencies(new Map(), {});
      expect(result).toEqual({});
    });

    it('handles fetch metadata failure', async () => {
      const peerRequirements = new Map();
      peerRequirements.set('nonexistent', new Set(['^1.0.0']));

      resolver.fetchPackageMetadata = jest.fn().mockRejectedValue(new Error('Not found'));

      const result = await resolver.resolvePeerDependencies(peerRequirements, {});

      expect(result).toEqual({});
    });
  });

  describe('checkPeerCompatibility', () => {
    it('returns empty array for compatible dependencies', () => {
      const peerDeps = { 'react': '^18.0.0' };
      const existingDeps = { 'react': '18.2.0' };

      const result = resolver.checkPeerCompatibility(peerDeps, existingDeps);

      expect(result).toEqual([]);
    });

    it('identifies incompatible dependencies', () => {
      const peerDeps = { 'react': '^18.0.0' };
      const existingDeps = { 'react': '17.0.0' };

      const result = resolver.checkPeerCompatibility(peerDeps, existingDeps);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('peer', 'react');
      expect(result[0]).toHaveProperty('required', '^18.0.0');
      expect(result[0]).toHaveProperty('existing', '17.0.0');
    });

    it('handles missing existing dependencies', () => {
      const peerDeps = { 'react': '^18.0.0' };
      const existingDeps = {};

      const result = resolver.checkPeerCompatibility(peerDeps, existingDeps);

      expect(result).toEqual([]);
    });
  });

  describe('autoResolvePeers', () => {
    it('auto-resolves peer dependencies', async () => {
      const warnings = [
        'Peer dependency missing: react@^18.0.0',
        'Peer dependency missing: react-dom@^18.0.0'
      ];
      const existingDeps = { 'react': '18.2.0' };

      // Mock the internal methods
      resolver.extractPeerRequirements = jest.fn().mockReturnValue(new Map([
        ['react', new Set(['^18.0.0'])],
        ['react-dom', new Set(['^18.0.0'])]
      ]));
      resolver.resolvePeerDependencies = jest.fn().mockResolvedValue({
        'react': '18.2.0',
        'react-dom': '18.2.0'
      });
      resolver.checkPeerCompatibility = jest.fn().mockReturnValue([]);

      const result = await resolver.autoResolvePeers(warnings, existingDeps);

      expect(result).toHaveProperty('react', '18.2.0');
      expect(result).toHaveProperty('react-dom', '18.2.0');
    });

    it('returns existing deps when no peer requirements', async () => {
      const warnings = [];
      const existingDeps = { 'lodash': '4.17.21' };

      const result = await resolver.autoResolvePeers(warnings, existingDeps);

      expect(result).toEqual(existingDeps);
    });

    it('handles incompatibilities gracefully', async () => {
      const warnings = ['Peer dependency missing: react@^18.0.0'];
      const existingDeps = { 'react': '17.0.0' };

      resolver.extractPeerRequirements = jest.fn().mockReturnValue(new Map([
        ['react', new Set(['^18.0.0'])]
      ]));
      resolver.resolvePeerDependencies = jest.fn().mockResolvedValue({
        'react': '18.2.0'
      });
      resolver.checkPeerCompatibility = jest.fn().mockReturnValue([
        { peer: 'react', required: '^18.0.0', existing: '17.0.0' }
      ]);

      const result = await resolver.autoResolvePeers(warnings, existingDeps);

      expect(result).toHaveProperty('react', '18.2.0');
    });
  });

  describe('fetchPackageMetadata', () => {
    it('fetches metadata from cache when available', async () => {
      const mockMetadata = { name: 'react', versions: { '18.2.0': {} } };
      const fs = require('fs/promises');
      fs.readFile.mockResolvedValue(JSON.stringify(mockMetadata));

      const result = await resolver.fetchPackageMetadata('react');

      expect(result).toEqual(mockMetadata);
      expect(fs.readFile).toHaveBeenCalled();
    });

    it('fetches from registry when not cached', async () => {
      const mockMetadata = { name: 'react', versions: { '18.2.0': {} } };
      const fs = require('fs/promises');
      const axios = require('axios');

      fs.readFile.mockRejectedValue(new Error('ENOENT'));
      axios.get.mockResolvedValue({ data: mockMetadata });
      fs.mkdir.mockResolvedValue(undefined);
      fs.writeFile.mockResolvedValue(undefined);

      const result = await resolver.fetchPackageMetadata('react');

      expect(result).toEqual(mockMetadata);
      expect(axios.get).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('handles fetch errors', async () => {
      const fs = require('fs/promises');
      const axios = require('axios');

      fs.readFile.mockRejectedValue(new Error('ENOENT'));
      axios.get.mockRejectedValue(new Error('Network error'));

      await expect(resolver.fetchPackageMetadata('nonexistent')).rejects.toThrow('Network error');
    });
  });
}); 