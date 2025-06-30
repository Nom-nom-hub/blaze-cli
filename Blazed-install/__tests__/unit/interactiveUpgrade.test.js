// Mock chalk to avoid ESM import issues
jest.mock('chalk', () => ({
  blue: jest.fn((text) => `BLUE_${text}`),
  green: jest.fn((text) => `GREEN_${text}`),
  red: jest.fn((text) => `RED_${text}`),
  yellow: jest.fn((text) => `YELLOW_${text}`),
  cyan: jest.fn((text) => `CYAN_${text}`),
  magenta: jest.fn((text) => `MAGENTA_${text}`),
  white: jest.fn((text) => `WHITE_${text}`),
  gray: jest.fn((text) => `GRAY_${text}`),
  bold: jest.fn((text) => `BOLD_${text}`),
  dim: jest.fn((text) => `DIM_${text}`)
}));

const { InteractiveUpgrade } = require('../../lib/interactiveUpgrade');

describe('InteractiveUpgrade', () => {
  let interactiveUpgrade;

  beforeEach(() => {
    interactiveUpgrade = new InteractiveUpgrade();
  });

  describe('package detection', () => {
    it('detects outdated packages', async () => {
      const dependencies = {
        'react': '18.2.0',
        'lodash': '4.17.20'
      };
      
      const outdated = await interactiveUpgrade.getOutdatedPackages(dependencies);
      expect(outdated.length).toBeGreaterThan(0);
      expect(outdated.find(p => p.name === 'react')).toBeDefined();
    });

    it('handles packages with no updates', async () => {
      const dependencies = {
        'nonexistent-package': '1.0.0'
      };
      
      const outdated = await interactiveUpgrade.getOutdatedPackages(dependencies);
      expect(outdated.length).toBe(0);
    });
  });

  describe('version comparison', () => {
    it('identifies major updates', () => {
      const updateType = interactiveUpgrade.getUpdateType('1.0.0', '2.0.0');
      expect(updateType).toBe('major');
    });

    it('identifies minor updates', () => {
      const updateType = interactiveUpgrade.getUpdateType('1.0.0', '1.1.0');
      expect(updateType).toBe('minor');
    });

    it('identifies patch updates', () => {
      const updateType = interactiveUpgrade.getUpdateType('1.0.0', '1.0.1');
      expect(updateType).toBe('patch');
    });
  });

  describe('mock registry', () => {
    it('returns latest versions for known packages', () => {
      const latest = interactiveUpgrade.getLatestVersion('react', '18.2.0');
      expect(latest).toBe('18.3.0');
    });

    it('returns current version for unknown packages', () => {
      const latest = interactiveUpgrade.getLatestVersion('unknown-package', '1.0.0');
      expect(latest).toBe('1.0.0');
    });
  });

  describe('formatting', () => {
    it('formats package choices correctly', () => {
      const pkg = {
        name: 'react',
        current: '18.2.0',
        latest: '18.3.0',
        type: 'minor'
      };
      
      const colors = {
        primary: (text) => `PRIMARY_${text}`,
        secondary: (text) => `SECONDARY_${text}`,
        error: (text) => `ERROR_${text}`,
        warning: (text) => `WARNING_${text}`,
        success: (text) => `SUCCESS_${text}`,
        info: (text) => `INFO_${text}`
      };
      
      const formatted = interactiveUpgrade.formatPackageChoice(pkg, colors);
      expect(formatted).toMatch(/🟡/);
      expect(formatted).toMatch(/react/);
      // Account for chalk mocking - check for the mocked color prefixes
      expect(formatted).toMatch(/PRIMARY_react/);
      expect(formatted).toMatch(/WARNING_18\.3\.0/);
      expect(formatted).toMatch(/→/);
    });
  });

  describe('type colors', () => {
    it('returns correct colors for update types', () => {
      const colors = {
        error: (text) => `ERROR_${text}`,
        warning: (text) => `WARNING_${text}`,
        success: (text) => `SUCCESS_${text}`
      };
      
      const majorColor = interactiveUpgrade.getTypeColor('major', colors);
      const minorColor = interactiveUpgrade.getTypeColor('minor', colors);
      const patchColor = interactiveUpgrade.getTypeColor('patch', colors);
      
      expect(majorColor).toBe(colors.error);
      expect(minorColor).toBe(colors.warning);
      expect(patchColor).toBe(colors.success);
    });
  });
}); 