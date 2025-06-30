const chalk = require('chalk');

function style(colorFn, ...styles) {return (text) => styles.reduce((acc, fn) => fn(acc), colorFn(text));
}

class ThemeManager {
  constructor() {this.themes = {
      default: {
        name: 'Default',
        description: 'Classic blue theme with good contrast',
        colors: {
          primary: chalk.blue,
          secondary: chalk.gray,
          success: chalk.green,
          warning: chalk.yellow,
          error: chalk.red,
          info: chalk.cyan,
          highlight: (text) => chalk.bold(chalk.blue(text)),
          muted: (text) => chalk.dim(chalk.gray(text))
        },
        symbols: {
          success: '✓',
          error: '✗',
          warning: '⚠',
          info: 'ℹ',
          progress: '█',
          empty: '░'
        }
      },
      rainbow: {
        name: 'Rainbow',
        description: 'Vibrant colors for a fun experience',
        colors: {
          primary: chalk.magenta,
          secondary: chalk.gray,
          success: chalk.green,
          warning: chalk.yellow,
          error: chalk.red,
          info: chalk.cyan,
          highlight: (text) => chalk.bold(chalk.magenta(text)),
          muted: (text) => chalk.dim(chalk.gray(text))
        },
        symbols: {
          success: '🌈',
          error: '💥',
          warning: '⚡',
          info: '💡',
          progress: '🎨',
          empty: '✨'
        }
      },
      minimal: {
        name: 'Minimal',
        description: 'Clean and simple design',
        colors: {
          primary: chalk.white,
          secondary: chalk.gray,
          success: chalk.green,
          warning: chalk.yellow,
          error: chalk.red,
          info: chalk.cyan,
          highlight: (text) => chalk.bold(chalk.white(text)),
          muted: (text) => chalk.dim(chalk.gray(text))
        },
        symbols: {
          success: '✓',
          error: '✗',
          warning: '!',
          info: 'i',
          progress: '|',
          empty: '-'
        }
      },
      corporate: {
        name: 'Corporate',
        description: 'Professional and bold design',
        colors: {
          primary: (text) => chalk.bold(chalk.blue(text)),
          secondary: chalk.gray,
          success: (text) => chalk.bold(chalk.green(text)),
          warning: (text) => chalk.bold(chalk.yellow(text)),
          error: (text) => chalk.bold(chalk.red(text)),
          info: (text) => chalk.bold(chalk.cyan(text)),
          highlight: (text) => chalk.underline(chalk.bold(chalk.blue(text))),
          muted: (text) => chalk.dim(chalk.gray(text))
        },
        symbols: {
          success: '✅',
          error: '❌',
          warning: '⚠️',
          info: 'ℹ️',
          progress: '█',
          empty: '░'
        }
      },
      dark: {
        name: 'Dark',
        description: 'Dark theme for low-light environments',
        colors: {
          primary: chalk.cyan,
          secondary: chalk.gray,
          success: chalk.green,
          warning: chalk.yellow,
          error: chalk.red,
          info: chalk.blue,
          highlight: (text) => chalk.bold(chalk.cyan(text)),
          muted: (text) => chalk.dim(chalk.gray(text))
        },
        symbols: {
          success: '✓',
          error: '✗',
          warning: '⚠',
          info: 'ℹ',
          progress: '█',
          empty: '░'
        }
      },
      retro: {
        name: 'Retro',
        description: 'Old-school terminal aesthetic',
        colors: {
          primary: chalk.green,
          secondary: chalk.gray,
          success: chalk.green,
          warning: chalk.yellow,
          error: chalk.red,
          info: chalk.cyan,
          highlight: (text) => chalk.bold(chalk.green(text)),
          muted: (text) => chalk.dim(chalk.gray(text))
        },
        symbols: {
          success: 'OK',
          error: 'ERR',
          warning: 'WARN',
          info: 'INFO',
          progress: '█',
          empty: '░'
        }
      }
    };

    this.currentTheme = 'default';
  }

  setTheme(themeName) {if (this.themes[themeName]) {this.currentTheme = themeName;
      return true;
    }
    return false;
  }

  getTheme(themeName = null) {const theme = themeName || this.currentTheme;
    return this.themes[theme] || this.themes.default;
  }

  getColors(themeName = null) {return this.getTheme(themeName).colors;
  }

  getSymbols(themeName = null) {return this.getTheme(themeName).symbols;
  }

  listThemes() {return Object.entries(this.themes).map(([key, theme]) => ({
      key,
      name: theme.name,
      description: theme.description,
      current: key === this.currentTheme
    }));
  }

  createCustomTheme(name, colors, symbols) {this.themes[name] = {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      description: 'Custom theme',
      colors: { ...this.themes.default.colors, ...colors },
      symbols: { ...this.themes.default.symbols, ...symbols }
    };
    return this.themes[name];
  }

  // Helper methods for common UI elements
  formatHeader(text, themeName = null) {const colors = this.getColors(themeName);
    return colors.highlight(`\n${text}\n${'='.repeat(text.length)}`);
  }

  formatSuccess(message, themeName = null) {const colors = this.getColors(themeName);
    const symbols = this.getSymbols(themeName);
    return colors.success(`${symbols.success} ${message}`);
  }

  formatError(message, themeName = null) {const colors = this.getColors(themeName);
    const symbols = this.getSymbols(themeName);
    return colors.error(`${symbols.error} ${message}`);
  }

  formatWarning(message, themeName = null) {const colors = this.getColors(themeName);
    const symbols = this.getSymbols(themeName);
    return colors.warning(`${symbols.warning} ${message}`);
  }

  formatInfo(message, themeName = null) {const colors = this.getColors(themeName);
    const symbols = this.getSymbols(themeName);
    return colors.info(`${symbols.info} ${message}`);
  }

  formatProgress(current, total, width = 40, themeName = null) {const colors = this.getColors(themeName);
    const symbols = this.getSymbols(themeName);
    
    const percentage = Math.round((current / total) * 100);
    const filledWidth = Math.round((current / total) * width);
    const emptyWidth = width - filledWidth;
    
    const filled = symbols.progress.repeat(filledWidth);
    const empty = symbols.empty.repeat(emptyWidth);
    
    return `${colors.primary(filled)}${colors.muted(empty)} ${colors.info(`${percentage}%`)}`;
  }

  formatPackageName(name, version, themeName = null) {const colors = this.getColors(themeName);
    return `${colors.primary(name)} ${colors.secondary(`@${version}`)}`;
  }

  formatVersion(current, latest, type, themeName = null) {const colors = this.getColors(themeName);
    const typeColors = {
      major: colors.error,
      minor: colors.warning,
      patch: colors.success
    };
    
    return `${colors.secondary(current)} → ${typeColors[type](latest)}`;
  }

  // Theme-specific box styles
  getBoxStyle(themeName = null) {const theme = this.getTheme(themeName);
    
    const boxStyles = {
      default: {
        topLeft: '╭',
        topRight: '╮',
        bottomLeft: '╰',
        bottomRight: '╯',
        horizontal: '─',
        vertical: '│'
      },
      minimal: {
        topLeft: '+',
        topRight: '+',
        bottomLeft: '+',
        bottomRight: '+',
        horizontal: '-',
        vertical: '|'
      },
      corporate: {
        topLeft: '┌',
        topRight: '┐',
        bottomLeft: '└',
        bottomRight: '┘',
        horizontal: '─',
        vertical: '│'
      }
    };
    
    return boxStyles[themeName] || boxStyles.default;
  }
}

module.exports = { ThemeManager }; 