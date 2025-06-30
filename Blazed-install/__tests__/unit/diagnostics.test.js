jest.mock('fs');
jest.mock('child_process', () => ({
  execSync: jest.fn()
}));

const fs = require('fs');
const path = require('path');
const { runDoctor } = require('../../lib/diagnostics');

const childProcess = require('child_process');

describe('diagnostics', () => {
  let consoleLogSpy;
  let consoleWarnSpy;
  let childProcess;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    childProcess = require('child_process');
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('runDoctor', () => {
    it('detects missing node_modules and suggests fix', async () => {
      fs.existsSync.mockImplementation((path) => {
        if (path === 'node_modules') return false;
        if (path === 'blaze-lock.json') return true;
        return true;
      });
      fs.readdirSync.mockReturnValue([]);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('"undefined" is not valid JSON');
      });

      await runDoctor(false);

      expect(consoleLogSpy).toHaveBeenCalledWith('Running blaze doctor...');
      expect(consoleWarnSpy).toHaveBeenCalledWith('Warning: node_modules directory is missing.');
      expect(consoleLogSpy).toHaveBeenCalledWith('Run `blaze install` to recreate it.');
    });

    it('fixes missing node_modules when fix=true', async () => {
      fs.existsSync.mockImplementation((path) => {
        if (path === 'node_modules') return false;
        if (path === 'blaze-lock.json') return true;
        return true;
      });
      fs.readdirSync.mockReturnValue([]);

      await runDoctor(true);

      expect(consoleLogSpy).toHaveBeenCalledWith('Recreating node_modules...');
      expect(childProcess.execSync).toHaveBeenCalledWith('npm install --package-lock-only', { stdio: 'inherit' });
    });

    it('detects missing lockfile and suggests fix', async () => {
      fs.existsSync.mockImplementation((path) => {
        if (path === 'node_modules') return true;
        if (path === 'blaze-lock.json') return false;
        return true;
      });
      fs.readdirSync.mockReturnValue([]);

      await runDoctor(false);

      expect(consoleWarnSpy).toHaveBeenCalledWith('Warning: blaze-lock.json is missing.');
      expect(consoleLogSpy).toHaveBeenCalledWith('Run `blaze install` to generate it.');
    });

    it('fixes missing lockfile when fix=true', async () => {
      fs.existsSync.mockImplementation((path) => {
        if (path === 'node_modules') return true;
        if (path === 'blaze-lock.json') return false;
        return true;
      });
      fs.readdirSync.mockReturnValue([]);

      await runDoctor(true);

      expect(consoleLogSpy).toHaveBeenCalledWith('Regenerating blaze-lock.json...');
      expect(childProcess.execSync).toHaveBeenCalledWith('node ./bin/blaze-install.js install', { stdio: 'inherit' });
    });

    it('detects lockfile/package.json mismatch', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue([]);
      fs.readFileSync.mockImplementation((path) => {
        if (path === 'package.json') {
          return JSON.stringify({
            dependencies: {
              lodash: '4.17.21',
              express: '4.18.2'
            }
          });
        }
        if (path === 'blaze-lock.json') {
          return JSON.stringify({
            lodash: { version: '4.17.21' }
          });
        }
        return '{}';
      });

      await runDoctor(false);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Warning: Some dependencies in package.json are missing from the lockfile:',
        ['express']
      );
    });

    it('fixes lockfile/package.json mismatch when fix=true', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue([]);
      fs.readFileSync.mockImplementation((path) => {
        if (path === 'package.json') {
          return JSON.stringify({
            dependencies: {
              lodash: '4.17.21',
              express: '4.18.2'
            }
          });
        }
        if (path === 'blaze-lock.json') {
          return JSON.stringify({
            lodash: { version: '4.17.21' }
          });
        }
        return '{}';
      });

      await runDoctor(true);

      expect(consoleLogSpy).toHaveBeenCalledWith('Regenerating blaze-lock.json...');
      expect(childProcess.execSync).toHaveBeenCalledWith('node ./bin/blaze-install.js install', { stdio: 'inherit' });
    });

    it('handles package.json read error gracefully', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue([]);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      await runDoctor(false);

      expect(consoleLogSpy).toHaveBeenCalledWith('Error reading package.json or lockfile:', 'ENOENT: no such file or directory');
    });

    it('detects broken symlinks in node_modules', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['lodash']);
      fs.readFileSync.mockReturnValue(JSON.stringify({ dependencies: {} }));
      fs.lstatSync.mockReturnValue({
        isSymbolicLink: () => true
      });
      fs.readlinkSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      await runDoctor(false);

      expect(consoleWarnSpy).toHaveBeenCalledWith(`Warning: Broken symlink detected: ${path.join('node_modules', 'lodash')}`);
    });

    it('fixes broken symlinks when fix=true', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['lodash']);
      fs.readFileSync.mockReturnValue(JSON.stringify({ dependencies: {} }));
      fs.lstatSync.mockReturnValue({
        isSymbolicLink: () => true
      });
      fs.readlinkSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      await runDoctor(true);

      expect(consoleWarnSpy).toHaveBeenCalledWith(`Removing broken symlink: ${path.join('node_modules', 'lodash')}`);
      expect(fs.unlinkSync).toHaveBeenCalledWith(path.join('node_modules', 'lodash'));
    });

    it('completes successfully when no issues found', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue([]);
      fs.readFileSync.mockReturnValue(JSON.stringify({ dependencies: {} }));

      await runDoctor(false);

      expect(consoleLogSpy).toHaveBeenCalledWith('blaze doctor completed.');
    });
  });
}); 