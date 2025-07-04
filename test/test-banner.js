const chalk = require('chalk');
let boxen = require('boxen');
if (boxen && boxen.default) boxen = boxen.default;

console.log(
  boxen(
    chalk.bold.cyan('🚀 Welcome to blaze-install!'),
    { padding: 1, borderColor: 'cyan', borderStyle: 'round' }
  )
);
console.log(
  boxen(
    chalk.bold.green('🔒 blaze-lock.json found. Installing from lockfile...'),
    { padding: 1, borderColor: 'green', borderStyle: 'round' }
  )
); 