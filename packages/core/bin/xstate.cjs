#!/usr/bin/env node
'use strict';

// Dependency-free launcher. `xstate migrate` delegates to the @xstate/codemod
// package, fetched on demand via npx so users don't install anything extra.
// Keeping this zero-dependency preserves `xstate`'s empty dependency set.

const { spawnSync } = require('node:child_process');

const [, , command, ...rest] = process.argv;

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return result.status ?? 1;
}

if (command === 'migrate') {
  // Pin to the same major as this xstate install when possible.
  const pkgVersion = require('../package.json').version;
  const major = String(pkgVersion).split('.')[0];
  const spec = `@xstate/codemod@^${major}`;
  process.exit(run('npx', ['-y', spec, ...rest]));
}

if (!command || command === '--help' || command === '-h') {
  console.log(
    [
      'Usage: xstate <command>',
      '',
      'Commands:',
      '  migrate [paths...] [--dry-run]   Run codemods to migrate XState code',
      '',
      'Examples:',
      '  npx xstate migrate ./src',
      '  npx xstate migrate ./src --dry-run'
    ].join('\n')
  );
  process.exit(command ? 0 : 1);
}

console.error(`Unknown command: ${command}\nRun \`xstate --help\`.`);
process.exit(1);
