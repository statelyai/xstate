import { createRequire } from 'node:module';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const compilerManifest = require('typescript/package.json');
const compiler = join(
  dirname(require.resolve('typescript/package.json')),
  compilerManifest.bin.tsc ?? compilerManifest.bin.tsc6
);
const cache = join(root, 'node_modules', '.cache');
mkdirSync(cache, { recursive: true });
const consumer = mkdtempSync(join(cache, 'xstate-types-'));
try {
  mkdirSync(join(consumer, 'node_modules'));
  symlinkSync(
    join(root, 'packages', 'core'),
    join(consumer, 'node_modules', 'xstate'),
    'dir'
  );
  writeFileSync(
    join(consumer, 'index.mts'),
    `
    import { createActor, createMachine } from 'xstate';
    import * as graph from 'xstate/graph';
    import * as durable from 'xstate/durable';
    import * as fsm from 'xstate/fsm';
    import * as validation from 'xstate/validation';
    const actor = createActor(createMachine({ initial: 'idle', states: { idle: {} } }));
    actor.start(); actor.stop();
    void [graph, durable, fsm, validation];
  `
  );
  writeFileSync(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        types: [],
        lib: ['ES2022', 'DOM']
      },
      files: ['index.mts']
    })
  );
  const result = spawnSync(
    process.execPath,
    [compiler, '--project', join(consumer, 'tsconfig.json')],
    { cwd: consumer, stdio: 'inherit' }
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      'Built package declarations failed strict consumer typechecking'
    );
  console.log('Built package declarations pass strict consumer typechecking.');
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
