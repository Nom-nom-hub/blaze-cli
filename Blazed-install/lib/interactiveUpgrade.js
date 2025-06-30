const inquirer = require('inquirer');
const semver = require('semver');
const chalk = require('chalk');
const { createBox } = require('./diagnostics');

class InteractiveUpgrade {
  constructor() {this.themes = {
      default: {
        primary: chalk.blue,
        secondary: chalk.gray,
        success: chalk.green,
        warning: chalk.yellow,
        error: chalk.red,
        info: chalk.cyan
      },
      rainbow: {
        primary: chalk.magenta,
        secondary: chalk.gray,
        success: chalk.green,
        warning: chalk.yellow,
        error: chalk.red,
        info: chalk.cyan
      },
      minimal: {
        primary: chalk.white,
        secondary: chalk.gray,
        success: chalk.green,
        warning: chalk.yellow,
        error: chalk.red,
        info: chalk.cyan
      },
      corporate: {
        primary: chalk.blue.bold,
        secondary: chalk.gray,
        success: chalk.green.bold,
        warning: chalk.yellow.bold,
        error: chalk.red.bold,
        info: chalk.cyan.bold
      }
    };
  }

  async getOutdatedPackages(dependencies) {
    const outdated = [];
    
    for (const [name, currentVersion] of Object.entries(dependencies)) {
      try {
        // This would normally fetch from registry
        // For now, we'll simulate some outdated packages
        const latestVersion = this.getLatestVersion(name, currentVersion);
        if (latestVersion && semver.gt(latestVersion, currentVersion)) {
          outdated.push({
            name,
            current: currentVersion,
            latest: latestVersion,
            type: this.getUpdateType(currentVersion, latestVersion)
          });
        }
      } catch (error) {
        console.warn(`Could not check ${name}: ${error.message}`);
      }
    }
    
    return outdated;
  }

  getLatestVersion(name, currentVersion) {// Simulate registry lookup - in real implementation, this would fetch from npm
    const mockLatestVersions = {
      'react': '18.3.0',
      'lodash': '4.17.22',
      'express': '4.19.2',
      'axios': '1.7.0',
      'chalk': '5.4.0',
      'inquirer': '9.2.15'
    };
    
    return mockLatestVersions[name] || currentVersion;
  }

  getUpdateType(current, latest) {const currentMajor = semver.major(current);
    const latestMajor = semver.major(latest);
    
    if (latestMajor > currentMajor) return 'major';
    if (semver.minor(latest) > semver.minor(current)) return 'minor';
    return 'patch';
  }

  async showUpgradeMenu(outdated, theme = 'default') {
    const colors = this.themes[theme] || this.themes.default;
    
    if (outdated.length === 0) {console.log(colors.success('✨ All packages are up to date!'));
      return [];
    }

    console.log(colors.primary('\n🔄 Interactive Package Upgrade'));
    console.log(colors.secondary('Select packages to upgrade:'));
    
    const choices = outdated.map(pkg => ({
      name: this.formatPackageChoice(pkg, colors),
      value: pkg.name,
      checked: pkg.type === 'patch' || pkg.type === 'minor' // Auto-check safe updates
    }));

    choices.push(new inquirer.Separator());
    choices.push({
      name: colors.info('📦 Select All'),
      value: 'select-all'
    });
    choices.push({
      name: colors.warning('🚫 Select None'),
      value: 'select-none'
    });
    choices.push(new inquirer.Separator());
    choices.push({
      name: colors.success('✅ Proceed with selected packages'),
      value: 'proceed'
    });
    choices.push({
      name: colors.secondary('❌ Cancel'),
      value: 'cancel'
    });

    const { selectedPackages } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedPackages',
        message: 'Choose packages to upgrade:',
        choices,
        pageSize: 15
      }
    ]);

    if (selectedPackages.includes('cancel')) {
      return [];
    }

    if (selectedPackages.includes('select-all')) {
      return outdated.map(pkg => pkg.name);
    }

    if (selectedPackages.includes('select-none')) {
      return [];
    }

    if (selectedPackages.includes('proceed')) {
      return selectedPackages.filter(pkg => pkg !== 'proceed');
    }

    return selectedPackages;
  }

  formatPackageChoice(pkg, colors) {const typeColors = {
      major: colors.error,
      minor: colors.warning,
      patch: colors.success
    };

    const typeSymbols = {
      major: '🔴',
      minor: '🟡', 
      patch: '🟢'
    };

    const typeColor = typeColors[pkg.type];
    const symbol = typeSymbols[pkg.type];
    
    return `${symbol} ${colors.primary(pkg.name)} ${colors.secondary(pkg.current)} → ${typeColor(pkg.latest)} (${pkg.type})`;
  }

  async showUpgradeSummary(selectedPackages, outdated, theme = 'default') {
    const colors = this.themes[theme] || this.themes.default;
    
    if (selectedPackages.length === 0) {console.log(colors.info('No packages selected for upgrade.'));
      return;
    }

    const selectedOutdated = outdated.filter(pkg => selectedPackages.includes(pkg.name));
    
    const summary = {
      total: selectedOutdated.length,
      major: selectedOutdated.filter(pkg => pkg.type === 'major').length,
      minor: selectedOutdated.filter(pkg => pkg.type === 'minor').length,
      patch: selectedOutdated.filter(pkg => pkg.type === 'patch').length
    };

    const boxContent = [
      colors.primary.bold('📦 Upgrade Summary'),
      '',
      `${colors.info('Total packages:')} ${colors.primary(summary.total)}`,
      `${colors.error('Major updates:')} ${colors.primary(summary.major)}`,
      `${colors.warning('Minor updates:')} ${colors.primary(summary.minor)}`,
      `${colors.success('Patch updates:')} ${colors.primary(summary.patch)}`,
      '',
      colors.secondary('Selected packages:'),
      ...selectedOutdated.map(pkg => 
        `  ${colors.primary(pkg.name)} ${colors.secondary(pkg.current)} → ${this.getTypeColor(pkg.type, colors)(pkg.latest)}`
      )
    ];

    console.log(createBox(boxContent, { theme }));
  }

  getTypeColor(type, colors) {const typeColors = {
      major: colors.error,
      minor: colors.warning,
      patch: colors.success
    };
    return typeColors[type] || colors.primary;
  }

  async confirmUpgrade(theme = 'default') {
    const colors = this.themes[theme] || this.themes.default;
    
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: colors.primary('Proceed with the upgrade?'),
        default: true
      }
    ]);

    return confirm;
  }

  async showUpgradeProgress(packages, theme = 'default') {
    const colors = this.themes[theme] || this.themes.default;
    
    console.log(colors.info('\n🚀 Starting upgrade process...'));
    
    // Simulate upgrade progress
    for (const pkg of packages) {console.log(colors.primary(`  Upgrading ${pkg.name}...`));
      // In real implementation, this would actually upgrade the package
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate work
      console.log(colors.success(`  ✓ ${pkg.name} upgraded successfully`));
    }
    
    console.log(colors.success('\n✨ All packages upgraded successfully!'));
  }
}

module.exports = { InteractiveUpgrade }; 