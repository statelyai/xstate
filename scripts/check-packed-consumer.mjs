// Packed-package consumer check.
//
// Packs `xstate`, `@xstate/react` and `@xstate/effect` with `pnpm pack`, unpacks the real
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
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rootRequire = createRequire(join(root, 'package.json'));
const ts = rootRequire('typescript');
const compilers = ['typescript', '@typescript/native'].map((name) => {
  const manifest = rootRequire(`${name}/package.json`);
  return {
    version: rootRequire(name).version ?? manifest.version,
    path: join(
      dirname(rootRequire.resolve(`${name}/package.json`)),
      manifest.bin.tsc ?? manifest.bin.tsc6
    )
  };
});

const PACKAGES = [
  { name: 'xstate', dir: 'core' },
  { name: '@xstate/react', dir: 'xstate-react' },
  { name: '@xstate/effect', dir: 'xstate-effect' }
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

const cache = tmpdir();
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
  step('source README links resolve to tracked files', () => {
    const tracked = new Set(run('git', ['ls-files', '-z'], root).split('\0'));
    const file = 'packages/core/README.md';
    const source = readFileSync(join(root, file), 'utf8');
    for (const [, link] of source.matchAll(/(?:\]\(|href=["'])([^\s)"']+)/g)) {
      const github = link.match(
        /^https:\/\/github\.com\/statelyai\/xstate\/(blob|tree)\/next\/([^?#]+)/
      );
      let target;
      if (github) {
        target = decodeURIComponent(github[2]);
        if (
          github[1] === 'tree' &&
          [...tracked].some((path) => path.startsWith(`${target}/`))
        ) {
          continue;
        }
      } else {
        if (/^(?:[a-z][a-z\d+.-]*:|#|\/)/i.test(link)) continue;
        target = relative(
          root,
          join(root, dirname(file), link.split(/[?#]/)[0])
        );
      }
      if (!tracked.has(target)) {
        throw new Error(`${file}: documentation link is not tracked: ${link}`);
      }
    }
  });

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
        if (manifest.peerDependenciesMeta?.[dependency]?.optional) continue;
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

  step(
    'tarball contains version-matched documentation and working local links',
    () => {
      const packageDir = join(nodeModules, 'xstate');
      const { version } = JSON.parse(
        readFileSync(join(packageDir, 'package.json'), 'utf8')
      );
      const { pages } = JSON.parse(
        readFileSync(join(root, 'docs/meta.json'), 'utf8')
      );
      const index = readFileSync(join(packageDir, 'docs/index.md'), 'utf8');
      if (!index.startsWith(`# XState ${version}\n`)) {
        throw new Error(
          'Bundled documentation version does not match the package'
        );
      }
      for (const page of pages) {
        if (!index.includes(`](${page}.md)`)) {
          throw new Error(`Bundled documentation index is missing ${page}`);
        }
      }
      for (const file of [
        'README.md',
        'docs/index.md',
        ...pages.map((page) => `docs/${page}.md`)
      ]) {
        const source = readFileSync(join(packageDir, file), 'utf8');
        for (const [, link] of source.matchAll(
          /(?:\]\(|href=["'])([^\s)"']+)/g
        )) {
          if (/^(?:[a-z][a-z\d+.-]*:|#|\/)/i.test(link)) continue;
          const target = join(packageDir, dirname(file), link.split(/[?#]/)[0]);
          if (!existsSync(target)) {
            throw new Error(
              `${file}: local documentation link is missing: ${link}`
            );
          }
        }
      }
    }
  );

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
    inactive: { on: { toggle: { target: 'active' } } },
    active: { on: { toggle: { target: 'inactive' } } }
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
  // Inferred setupEffect() exports must name only public types (#5832).
  writeFileSync(
    join(consumer, 'effect.ts'),
    `import { Effect } from 'effect';
import { setupEffect } from '@xstate/effect';

export const effectMachine = setupEffect({
  actions: { audit: (_args) => Effect.void }
}).createMachine({});

export const effectSetup = setupEffect({
  actions: {
    audit: (args: { context: { label: string } }) =>
      Effect.log(args.context.label)
  }
});
`
  );
  // Same source compiled as CommonJS under node16 to exercise `require` types.
  writeFileSync(join(consumer, 'machine.cts'), machineSource);
  const readme = readFileSync(join(nodeModules, 'xstate/README.md'), 'utf8');
  const readmeExample = readme.match(/```ts\n([\s\S]*?)\n```/)?.[1];
  if (!readmeExample) throw new Error('README quick start example is missing');
  writeFileSync(join(consumer, 'readme.ts'), readmeExample);
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
import { useActorRef } from '@xstate/react';
import { createEffectActor, setupEffect } from '@xstate/effect';
if (typeof setupEffect !== 'function' || typeof createEffectActor !== 'function') {
  throw new Error('@xstate/effect: setupEffect or createEffectActor missing');
}`)
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
      files: ['machine.ts', 'effect.ts', 'react.tsx', 'readme.ts']
    },
    node16: {
      module: 'node16',
      moduleResolution: 'node16',
      files: [
        'machine.ts',
        'machine.cts',
        'effect.ts',
        'react.tsx',
        'readme.ts'
      ]
    },
    'bundler-exact': {
      module: 'ESNext',
      moduleResolution: 'bundler',
      exactOptionalPropertyTypes: true,
      files: ['machine.ts', 'effect.ts', 'react.tsx', 'readme.ts']
    },
    'node16-exact': {
      module: 'node16',
      moduleResolution: 'node16',
      exactOptionalPropertyTypes: true,
      files: [
        'machine.ts',
        'machine.cts',
        'effect.ts',
        'react.tsx',
        'readme.ts'
      ]
    }
  };
  for (const compiler of compilers) {
    for (const [label, { files, ...options }] of Object.entries(configs)) {
      step(
        `TypeScript ${compiler.version} declaration emit (moduleResolution: ${label})`,
        () => {
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
            [compiler.path, '-p', configPath, '--pretty', 'false'],
            consumer
          );
        }
      );
    }
  }

  step('packed agent CLI and version-matched docs', () => {
    const cli = join(nodeModules, 'xstate/bin/xstate.js');
    const invoke = (command, ...args) => {
      const response = JSON.parse(
        run(process.execPath, [cli, command, ...args, '--json'], consumer)
      );
      if (!response.ok) throw new Error(JSON.stringify(response.error));
      return response;
    };
    const docs = invoke('docs');
    if (
      docs.result.stability.xstateVersion !== docs.xstateVersion ||
      !existsSync(docs.result.agentGuide)
    ) {
      throw new Error('Packed agent docs must match the installed package.');
    }
    const machine = join(consumer, 'agent-machine.json');
    const events = join(consumer, 'agent-events.json');
    writeFileSync(
      machine,
      JSON.stringify({
        initial: 'idle',
        states: {
          idle: { on: { GO: { target: 'done' } } },
          done: { type: 'final' }
        }
      })
    );
    writeFileSync(events, JSON.stringify([{ type: 'GO' }]));
    invoke('validate', machine);
    const inspection = invoke('inspect', machine);
    if (!inspection.result.graph.analysis.transitionTargetsComplete)
      throw new Error('Static graph was incomplete.');
    const simulation = invoke('simulate', machine, events);
    if (
      simulation.result.trace.at(-1).snapshot.value !== 'done' ||
      simulation.result.effectsExecuted !== false
    ) {
      throw new Error('Packed CLI simulation did not reach its final state.');
    }
  });
  step('node esm.mjs', () => run(process.execPath, ['esm.mjs'], consumer));
  step('node cjs.cjs', () => run(process.execPath, ['cjs.cjs'], consumer));
  step('README quick start runs with the packed package', () => {
    const source = `${readmeExample}
if (toggleActor.getSnapshot().value !== 'inactive' || toggleActor.getSnapshot().context.count !== 1) {
  throw new Error('README quick start produced an unexpected snapshot');
}
toggleActor.send({ type: 'TOGGLE' });
if (toggleActor.getSnapshot().value !== 'active' || toggleActor.getSnapshot().context.count !== 2) {
  throw new Error('README quick start did not update context on re-entry');
}
toggleActor.stop();
`;
    writeFileSync(
      join(consumer, 'readme.mjs'),
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022
        }
      }).outputText
    );
    run(process.execPath, ['readme.mjs'], consumer);
  });
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
