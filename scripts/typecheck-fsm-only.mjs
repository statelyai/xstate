// Compiles an fsm-only consumer in isolation (tsconfig.fsm-only.json) and
// asserts the resulting program stays lean: the `xstate/fsm` entry must not
// pull the main entry's type surface (types.ts, setup.ts, etc.) back in.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const allowedProgramFiles = new Set([
  'packages/core/src/schema.types.ts',
  'packages/core/src/base.types.ts',
  'packages/core/src/fsm.ts',
  'packages/core/src/fsm/index.ts',
  'scripts/typecheck-fixtures/fsm-only-consumer.ts'
]);

let stdout;
try {
  stdout = execFileSync(
    'npx',
    ['tsc', '-p', 'tsconfig.fsm-only.json', '--listFiles'],
    { cwd: root, encoding: 'utf8' }
  );
} catch (error) {
  process.stderr.write(error.stdout ?? '');
  process.stderr.write(error.stderr ?? '');
  console.error('\nfsm-only typecheck failed.');
  process.exit(1);
}

const unexpected = stdout
  .split('\n')
  .filter((line) => line.trim() !== '' && !line.includes('node_modules'))
  .map((line) => path.relative(root, line.trim()))
  .filter((file) => !allowedProgramFiles.has(file));

if (unexpected.length > 0) {
  console.error(
    'The xstate/fsm entry pulled unexpected files into an fsm-only program:\n' +
      unexpected.map((file) => `  ${file}`).join('\n') +
      '\n\nKeep the fsm type-import chain limited to base.types.ts and ' +
      'schema.types.ts (or update the allowlist in scripts/typecheck-fsm-only.mjs ' +
      'if a new lean module is intentional).'
  );
  process.exit(1);
}

console.log('fsm-only typecheck passed with a lean program.');
