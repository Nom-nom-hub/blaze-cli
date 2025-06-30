const execa = require('execa');
const path = require('path');

describe('blaze theme', () => {
  const cli = path.resolve(__dirname, '../../bin/blaze-install.js');

  it('shows theme help', async () => {
    const { stdout } = await execa('node', [cli, 'theme', '--help']);
    expect(stdout).toMatch(/theme/);
  }, 10000);

  it('lists available themes', async () => {
    const { stdout } = await execa('node', [cli, 'theme', 'list']);
    expect(stdout).toMatch(/Available Themes/);
    expect(stdout).toMatch(/Default/);
  }, 10000);

  it('shows theme set help', async () => {
    const { stdout } = await execa('node', [cli, 'theme', 'set', '--help']);
    expect(stdout).toMatch(/set/);
  }, 10000);
}); 