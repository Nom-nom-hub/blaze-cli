#!/usr/bin/env node

const { main } = require('../lib/index');

(async () => {
  const args = process.argv.slice(2);
  const command = args[0];

  // Check for help flags
  if (!command || command === '--help' || command === 'help' || command === '-h') {
    await main(['help']);
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
    'upgrade-interactive',
    'doctor',
    'prefetch',
    'theme',
    // Enterprise commands
    'migrate',
    'validate',
    'profile',
    'registry',
    'signing',
  ];

  if (supported.includes(command)) {
    await main(args);
  } else {
    console.log('Unknown command:', command);
    await main(['help']);
    process.exit(1);
  }
})(); 