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

const { ThemeManager } = require('../../lib/themeManager');

describe('ThemeManager', () => {
  let themeManager;

  beforeEach(() => {
    themeManager = new ThemeManager();
  });

  describe('theme management', () => {
    it('lists all available themes', () => {
      const themes = themeManager.listThemes();
      expect(themes).toHaveLength(6); // default, rainbow, minimal, corporate, dark, retro
      expect(themes.find(t => t.key === 'default')).toBeDefined();
      expect(themes.find(t => t.key === 'rainbow')).toBeDefined();
    });

    it('sets and gets themes', () => {
      const success = themeManager.setTheme('rainbow');
      expect(success).toBe(true);
      
      const theme = themeManager.getTheme();
      expect(theme.name).toBe('Rainbow');
    });

    it('returns false for invalid theme', () => {
      const success = themeManager.setTheme('invalid-theme');
      expect(success).toBe(false);
    });

    it('gets colors for specific theme', () => {
      const colors = themeManager.getColors('corporate');
      expect(colors.primary).toBeDefined();
      expect(colors.success).toBeDefined();
      expect(colors.error).toBeDefined();
    });

    it('gets symbols for specific theme', () => {
      const symbols = themeManager.getSymbols('retro');
      expect(symbols.success).toBe('OK');
      expect(symbols.error).toBe('ERR');
    });
  });

  describe('formatting methods', () => {
    it('formats success messages', () => {
      const message = themeManager.formatSuccess('Test success');
      expect(message).toMatch(/✓ Test success/);
    });

    it('formats error messages', () => {
      const message = themeManager.formatError('Test error');
      expect(message).toMatch(/✗ Test error/);
    });

    it('formats warning messages', () => {
      const message = themeManager.formatWarning('Test warning');
      expect(message).toMatch(/⚠ Test warning/);
    });

    it('formats info messages', () => {
      const message = themeManager.formatInfo('Test info');
      expect(message).toMatch(/ℹ Test info/);
    });

    it('formats progress bars', () => {
      const progress = themeManager.formatProgress(50, 100);
      expect(progress).toMatch(/50%/);
    });

    it('formats package names', () => {
      const formatted = themeManager.formatPackageName('lodash', '4.17.21');
      expect(formatted).toMatch(/lodash/);
      expect(formatted).toMatch(/@4\.17\.21/);
    });

    it('formats version updates', () => {
      const formatted = themeManager.formatVersion('4.17.20', '4.17.21', 'patch');
      // Account for chalk mocking - check for the mocked color prefixes
      expect(formatted).toMatch(/GRAY_4\.17\.20/);
      expect(formatted).toMatch(/GREEN_4\.17\.21/);
      expect(formatted).toMatch(/→/);
    });
  });

  describe('custom themes', () => {
    it('creates custom themes', () => {
      const customColors = {
        primary: (text) => `CUSTOM_${text}`
      };
      const customSymbols = {
        success: 'SUCCESS'
      };
      
      const customTheme = themeManager.createCustomTheme('custom', customColors, customSymbols);
      expect(customTheme.name).toBe('Custom');
      expect(customTheme.colors.primary).toBeDefined();
      expect(customTheme.symbols.success).toBe('SUCCESS');
    });
  });
}); 