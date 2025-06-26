#!/usr/bin/env node

const { main, printHelp } = require('../lib/index');
let chalk;
async function getChalk() {
  if (!chalk) {
    chalk = (await import('chalk')).default;
  }
  return chalk;
}

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === '--help' || command === 'help') {
  printHelp();
  process.exit(0);
}

// Supported commands (add more as you implement them)
const supported = [
  'install',
  'uninstall',
  'update',
  'audit',
  'list',
  'clean',
  'outdated',
  'info',
  '--interactive',
  'publish',
  'version',
  'audit fix',
  'run',
  'link',
  'unlink',
  'graph',
  'upgrade',
  'doctor',
  'prefetch',
];

if (supported.includes(command)) {
  main(args);
} else {
  console.log('Unknown command:', command);
  printHelp();
  process.exit(1);
} 