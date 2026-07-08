#!/usr/bin/env node
// Lightweight `xstate` CLI. Heavy commands are delegated to dedicated
// packages fetched on demand so the core package stays dependency-free.
const { spawnSync } = require('child_process');

const [command, ...rest] = process.argv.slice(2);

switch (command) {
  case 'migrate': {
    // Delegates to @xstate/codemod (ts-morph based v5 → v6 codemods).
    const result = spawnSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['-y', '@xstate/codemod', 'migrate', ...rest],
      { stdio: 'inherit' }
    );
    process.exit(result.status ?? 1);
    break;
  }
  case '--help':
  case 'help':
  case undefined:
    console.log(
      [
        'Usage: xstate <command>',
        '',
        'Commands:',
        '  migrate [globs...] [--dry]   Migrate source files to the current XState version',
        '                               (delegates to @xstate/codemod)'
      ].join('\n')
    );
    process.exit(command ? 0 : 1);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
