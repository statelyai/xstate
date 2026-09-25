// Packed-package consumer check.
//
// Packs `xstate` and `@xstate/react` with `pnpm pack`, unpacks the real
// tarballs into a fresh consumer project (no workspace links), then:
//   - verifies every file referenced by `main`/`module`/`types`/`exports`
//     is present in the tarball,
//   - emits declarations for a representative exported machine with
//     `skipLibCheck: false` under `moduleResolution: bundler` and `node16`
//     (catches TS2742 / TS4023 / TS7056 and any other declaration error),
//   - runs ESM and CJS smoke scripts under Node,
//   - asserts production (non-`development`) dist files contain no
//     `process.env.NODE_ENV` (dev branches are selected through the
//     `development` export condition, not through NODE_ENV).
//
// Tarballs are unpacked instead of `npm install`ed so the check runs offline;
// runtime dependencies are linked from the workspace's resolved copies.
//
// Requires `pnpm build` first.
//
// Usage: node scripts/check-packed-consumer.mjs

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rootRequire = createRequire(join(root, 'package.json'));
const tsManifest = rootRequire('typescript/package.json');
const tsc = join(
  dirname(rootRequire.resolve('typescript/package.json')),
  tsManifest.bin.tsc ?? tsManifest.bin.tsc6
);

const PACKAGES = [
  { name: 'xstate', dir: 'core' },
  { name: '@xstate/react', dir: 'xstate-react' }
];

const results = [];
function step(name, fn) {
  const start = Date.now();
  try {
    fn();
    results.push({ name, ok: true, ms: Date.now() - start });
  } catch (error) {
    results.push({
      name,
      ok: false,
      ms: Date.now() - start,
      detail: String(error?.message ?? error).trim()
    });
  }
}
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${[command, ...args].join(' ')} exited ${result.status}\n` +
        `${result.stdout}${result.stderr}`
    );
  }
  return result.stdout;
}

for (const { dir } of PACKAGES) {
  if (!existsSync(join(root, 'packages', dir, 'dist'))) {
    console.error(`packages/${dir}/dist is missing. Run \`pnpm build\` first.`);
    process.exit(1);
  }
}

const cache = join(root, 'node_modules', '.cache');
mkdirSync(cache, { recursive: true });
const work = mkdtempSync(join(cache, 'xstate-packed-'));
const tarballs = join(work, 'tarballs');
const consumer = join(work, 'consumer');
const nodeModules = join(consumer, 'node_modules');
mkdirSync(tarballs);
mkdirSync(join(nodeModules, '@xstate'), { recursive: true });

function linkDependency(name, fromDir) {
  const target = join(nodeModules, name);
  if (existsSync(target)) return;
  const packageRequire = createRequire(join(fromDir, 'package.json'));
  mkdirSync(dirname(target), { recursive: true });
  symlinkSync(
    dirname(packageRequire.resolve(`${name}/package.json`)),
    target,
    'dir'
  );
}

function exportTargets(value) {
  if (typeof value === 'string') return [value];
  if (!value || typeof value !== 'object') return [];
  return Object.values(value).flatMap(exportTargets);
}

try {
  step('pack + unpack tarballs', () => {
    for (const { name, dir } of PACKAGES) {
      const packageDir = join(root, 'packages', dir);
      const before = new Set(readdirSync(tarballs));
      run('pnpm', ['pack', '--pack-destination', tarballs], packageDir);
      const tarball = readdirSync(tarballs).find((file) => !before.has(file));
      if (!tarball)
        throw new Error(`pnpm pack produced no tarball for ${name}`);
      const destination = join(nodeModules, name);
      mkdirSync(destination, { recursive: true });
      run('tar', [
        '-xzf',
        join(tarballs, tarball),
        '-C',
        destination,
        '--strip-components=1'
      ]);
      const manifest = JSON.parse(
        readFileSync(join(destination, 'package.json'), 'utf8')
      );
      for (const dependency of [
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.peerDependencies ?? {})
      ]) {
        if (PACKAGES.some((pkg) => pkg.name === dependency)) continue;
        linkDependency(dependency, packageDir);
      }
    }
    // Types for the React adapter's declarations (skipLibCheck is off).
    for (const types of ['@types/react', '@types/use-sync-external-store']) {
      linkDependency(types, join(root, 'packages', 'xstate-react'));
    }
  });

  step('tarball contains every published entry file', () => {
    const missing = [];
    for (const { name } of PACKAGES) {
      const packageDir = join(nodeModules, name);
      const manifest = JSON.parse(
        readFileSync(join(packageDir, 'package.json'), 'utf8')
      );
      const targets = [
        manifest.main,
        manifest.module,
        manifest.types,
        ...exportTargets(manifest.exports)
      ].filter(Boolean);
      for (const target of new Set(targets)) {
        if (!existsSync(join(packageDir, target))) {
          missing.push(`${name}: ${target}`);
        }
      }
    }
    if (missing.length) throw new Error(`Missing:\n  ${missing.join('\n  ')}`);
  });

  step('no process.env.NODE_ENV in production dist', () => {
    const offenders = [];
    for (const { name } of PACKAGES) {
      const dist = join(nodeModules, name, 'dist');
      for (const file of readdirSync(dist)) {
        if (!/\.(c|m)?js$/.test(file) || file.includes('.development.')) {
          continue;
        }
        if (
          readFileSync(join(dist, file), 'utf8').includes(
            'process.env.NODE_ENV'
          )
        ) {
          offenders.push(`${name}/dist/${file}`);
        }
      }
    }
    if (offenders.length) {
      throw new Error(
        `Found process.env.NODE_ENV in:\n  ${offenders.join('\n  ')}`
      );
    }
  });

  const machineSource = `
import { createActor, setup, types } from 'xstate';
import { createAsyncLogic } from 'xstate/actors';

interface User {
  id: number;
  name: string;
}

const fetchUser = createAsyncLogic({
  run: async ({ input }: { input: { id: number } }): Promise<User> => ({
    id: input.id,
    name: 'Ada'
  })
});

export const userSetup = setup({
  schemas: {
    context: types<{ userId: number; user: User | null; retries: number }>(),
    events: { load: types<{ id: number }>(), retry: types<{}>() }
  },
  states: {
    idle: {},
    loading: {},
    loaded: {},
    failed: {},
    cooldown: {}
  },
  actors: { fetchUser },
  guards: {
    canRetry: (retries: number) => retries < 3
  },
  delays: {
    backoff: ({ context }) => context.retries * 100
  }
});

export const userMachine = userSetup.createMachine({
  context: { userId: 0, user: null, retries: 0 },
  initial: 'idle',
  states: {
    idle: {
      on: {
        load: ({ context, event }) => ({
          target: 'loading',
          context: { ...context, userId: event.id }
        })
      }
    },
    loading: {
      invoke: {
        src: 'fetchUser',
        input: ({ context }) => ({ id: context.userId }),
        onDone: ({ context, event }) => ({
          target: 'loaded',
          context: { ...context, user: event.output }
        }),
        onError: { target: 'failed' }
      }
    },
    loaded: {},
    failed: {
      on: {
        retry: ({ context, guards }) =>
          guards.canRetry(context.retries)
            ? {
                target: 'cooldown',
                context: { ...context, retries: context.retries + 1 }
              }
            : undefined
      }
    },
    cooldown: {
      after: { backoff: { target: 'loading' } }
    }
  }
});

export const userActor = createActor(userMachine);
`;

  const smoke = (importLines) => `${importLines}
const machine = createMachine({
  initial: 'inactive',
  states: {
    inactive: { on: { toggle: 'active' } },
    active: { on: { toggle: 'inactive' } }
  }
});
const actor = createActor(machine).start();
actor.send({ type: 'toggle' });
if (actor.getSnapshot().value !== 'active') {
  throw new Error('Expected "active", got ' + JSON.stringify(actor.getSnapshot().value));
}
actor.stop();
if (typeof createAsyncLogic !== 'function') throw new Error('xstate/actors: createAsyncLogic missing');
if (typeof useActorRef !== 'function') throw new Error('@xstate/react: useActorRef missing');
console.log('ok');
`;

  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({ name: 'packed-consumer', private: true, type: 'module' })
  );
  writeFileSync(join(consumer, 'machine.ts'), machineSource);
  // Same source compiled as CommonJS under node16 to exercise `require` types.
  writeFileSync(join(consumer, 'machine.cts'), machineSource);
  writeFileSync(
    join(consumer, 'react.tsx'),
    `import { useActorRef, useSelector } from '@xstate/react';
import { userMachine } from './machine.js';
export function useUserState() {
  const actorRef = useActorRef(userMachine);
  return useSelector(actorRef, (snapshot) => snapshot.value);
}
`
  );
  writeFileSync(
    join(consumer, 'esm.mjs'),
    smoke(`import { createMachine, createActor } from 'xstate';
import { createAsyncLogic } from 'xstate/actors';
import { useActorRef } from '@xstate/react';`)
  );
  writeFileSync(
    join(consumer, 'cjs.cjs'),
    smoke(`const { createMachine, createActor } = require('xstate');
const { createAsyncLogic } = require('xstate/actors');
const { useActorRef } = require('@xstate/react');`)
  );

  const configs = {
    bundler: {
      module: 'ESNext',
      moduleResolution: 'bundler',
      files: ['machine.ts', 'react.tsx']
    },
    node16: {
      module: 'node16',
      moduleResolution: 'node16',
      files: ['machine.ts', 'machine.cts', 'react.tsx']
    }
  };
  for (const [label, { files, ...options }] of Object.entries(configs)) {
    step(`tsc declaration emit (moduleResolution: ${label})`, () => {
      const configPath = join(consumer, `tsconfig.${label}.json`);
      writeFileSync(
        configPath,
        JSON.stringify({
          compilerOptions: {
            ...options,
            target: 'ES2022',
            strict: true,
            jsx: 'react-jsx',
            declaration: true,
            emitDeclarationOnly: true,
            skipLibCheck: false,
            types: [],
            lib: ['ES2022', 'DOM'],
            outDir: `out-${label}`
          },
          files
        })
      );
      run(
        process.execPath,
        [tsc, '-p', configPath, '--pretty', 'false'],
        consumer
      );
    });
  }

  step('node esm.mjs', () => run(process.execPath, ['esm.mjs'], consumer));
  step('node cjs.cjs', () => run(process.execPath, ['cjs.cjs'], consumer));
} finally {
  // Set PACKED_CONSUMER_KEEP=1 to inspect the consumer project afterwards.
  if (process.env.PACKED_CONSUMER_KEEP) console.log(`Kept ${work}`);
  else rmSync(work, { recursive: true, force: true });
}

console.log('Packed consumer check:');
for (const { name, ok, ms, detail } of results) {
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  ${name} (${(ms / 1000).toFixed(1)}s)`
  );
  if (detail) console.log(detail.replace(/^/gm, '        '));
}
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`\n${failed.length} packed-consumer check(s) failed.`);
  process.exit(1);
}
console.log('\nAll packed-consumer checks passed.');
