const { VersionConflictResolver } = require('../../lib/versionConflictResolver');
const resolver = require('../../lib/versionConflictResolver');

describe('VersionConflictResolver', () => {
  let resolver;

  beforeEach(() => {
    resolver = new VersionConflictResolver();
  });

  describe('resolveConflicts', () => {
    it('resolves simple version conflicts', async () => {
      const conflicts = [
        { package: 'lodash', versions: ['4.17.21', '4.17.20'] }
      ];

      const result = await resolver.resolveConflicts(conflicts);

      expect(result).toHaveProperty('lodash');
      expect(result.lodash).toBe('4.17.21'); // Should pick highest version
    });

    it('handles empty conflicts', async () => {
      const result = await resolver.resolveConflicts([]);
      expect(result).toEqual({});
    });

    it('resolves multiple package conflicts', async () => {
      const conflicts = [
        { package: 'lodash', versions: ['4.17.21', '4.17.20'] },
        { package: 'react', versions: ['18.2.0', '18.1.0'] }
      ];

      const result = await resolver.resolveConflicts(conflicts);

      expect(result).toHaveProperty('lodash', '4.17.21');
      expect(result).toHaveProperty('react', '18.2.0');
    });

    it('handles invalid version strings', async () => {
      const conflicts = [
        { package: 'invalid', versions: ['not-a-version', 'also-invalid'] }
      ];

      const result = await resolver.resolveConflicts(conflicts);

      expect(result).toHaveProperty('invalid');
      // Should handle gracefully, possibly return first version or null
    });
  });

  describe('detectConflicts', () => {
    it('detects version conflicts in dependency tree', () => {
      const tree = {
        'package-a': { version: '1.0.0', dependencies: { 'shared': '^1.0.0' } },
        'package-b': { version: '2.0.0', dependencies: { 'shared': '^2.0.0' } }
      };

      const conflicts = resolver.detectConflicts(tree);

      expect(conflicts).toContainEqual(
        expect.objectContaining({
          package: 'shared',
          versions: expect.arrayContaining(['^1.0.0', '^2.0.0'])
        })
      );
    });

    it('returns empty array for no conflicts', () => {
      const tree = {
        'package-a': { version: '1.0.0', dependencies: { 'shared': '^1.0.0' } },
        'package-b': { version: '2.0.0', dependencies: { 'shared': '^1.0.0' } }
      };

      const conflicts = resolver.detectConflicts(tree);

      expect(conflicts).toEqual([]);
    });

    it('handles empty dependency tree', () => {
      const conflicts = resolver.detectConflicts({});
      expect(conflicts).toEqual([]);
    });
  });

  describe('suggestResolutions', () => {
    it('suggests resolutions for conflicts', () => {
      const conflicts = [
        { package: 'lodash', versions: ['4.17.21', '4.17.20'] }
      ];

      const suggestions = resolver.suggestResolutions(conflicts);

      expect(suggestions).toHaveProperty('lodash');
      expect(suggestions.lodash).toContain('4.17.21');
    });

    it('handles empty conflicts', () => {
      const suggestions = resolver.suggestResolutions([]);
      expect(suggestions).toEqual({});
    });

    it('provides multiple resolution options', () => {
      const conflicts = [
        { package: 'react', versions: ['18.2.0', '17.0.0'] }
      ];

      const suggestions = resolver.suggestResolutions(conflicts);

      expect(suggestions.react).toBeInstanceOf(Array);
      expect(suggestions.react.length).toBeGreaterThan(0);
    });
  });

  describe('validateResolution', () => {
    it('validates successful resolution', () => {
      const conflicts = [
        { package: 'lodash', versions: ['4.17.21', '4.17.20'] }
      ];
      const resolution = { lodash: '4.17.21' };

      const result = resolver.validateResolution(conflicts, resolution);

      expect(result.valid).toBe(true);
      expect(result.remainingConflicts).toEqual([]);
    });

    it('identifies invalid resolutions', () => {
      const conflicts = [
        { package: 'lodash', versions: ['4.17.21', '4.17.20'] }
      ];
      const resolution = { lodash: '4.16.0' }; // Not in conflict list

      const result = resolver.validateResolution(conflicts, resolution);

      expect(result.valid).toBe(false);
      expect(result.remainingConflicts.length).toBeGreaterThan(0);
    });

    it('handles partial resolutions', () => {
      const conflicts = [
        { package: 'lodash', versions: ['4.17.21', '4.17.20'] },
        { package: 'react', versions: ['18.2.0', '17.0.0'] }
      ];
      const resolution = { lodash: '4.17.21' }; // Only resolves one

      const result = resolver.validateResolution(conflicts, resolution);

      expect(result.valid).toBe(false);
      expect(result.remainingConflicts).toContainEqual(
        expect.objectContaining({ package: 'react' })
      );
    });
  });
});

describe('versionConflictResolver', () => {
  it('should export an object', () => {
    expect(typeof resolver).toBe('object');
  });
}); 