const chalk = require('chalk');
const boxen = require('boxen');

function printBanner() {
  const banner = boxen(
    chalk.cyan.bold('Welcome to ') + chalk.yellowBright.bold('blaze-install') + '\n' + chalk.gray('The blazing fast JS package manager'),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'magenta',
      backgroundColor: 'black',
      align: 'center',
    }
  );
  console.log(banner);
}

printBanner();

module.exports = {
  afterInstall: printBanner,
  afterUpdate: printBanner,
};
