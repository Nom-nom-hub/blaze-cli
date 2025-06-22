#!/usr/bin/env node

const { main } = require('../lib/index');

const args = process.argv.slice(2);

if (args[0] === 'install') {
  main(args.slice(1));
} else if (['uninstall', 'update', 'audit'].includes(args[0])) {
  main(args);
} else {
  console.log('Usage: blaze <install|uninstall|update|audit> [package] [--symlink] [--save-dev] [--production]');
  process.exit(1);
} 