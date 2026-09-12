// Bundle-size benchmark for XState, stores, and representative adapters.
//
// Measures min+gzip size of representative entry profiles bundled from source,
// compares them against the thresholds in
// scripts/bundle-size.thresholds.json, and exits non-zero on regression.
//
// Usage:
//   node scripts/bundle-size.mjs            # measure + check thresholds
//   node scripts/bundle-size.mjs --update   # rewrite thresholds to current sizes
//   node scripts/bundle-size.mjs --why      # per-module byte attribution
//   node scripts/bundle-size.mjs --dist     # diagnose the latest local build
//   node scripts/bundle-size.mjs --json     # machine-readable results
//   node scripts/bundle-size.mjs --profile=minimal-machine
//   node scripts/bundle-size.mjs --verify   # assert output of both minifiers
//   node scripts/bundle-size.mjs --report   # report without enforcing stale budgets
//   node scripts/bundle-size.mjs --report --experiment=lazy-bind # rejected prototype
//
// Source is canonical so the gate cannot accidentally measure stale build
// artifacts. `--dist` requires `preconstruct build` to have run first.
// esbuild is resolved through vite's dependency graph so this script adds no
// new dependency to the repo.

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { lazyBindingsExperiment } from './bundle-size-experiment.mjs';
import { verifyBundle } from './bundle-size-verify.mjs';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  symlinkSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzip } from 'pako';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// pnpm doesn't hoist esbuild to the root, so resolve it through the
// dependency chain root -> vitest -> vite -> esbuild (Node resolves through
// the .pnpm symlinks to real paths).
const rootRequire = createRequire(join(root, 'package.json'));
// Node links against different zlib versions across platforms and releases.
// A pinned JS implementation keeps exact gzip thresholds reproducible.
const viteRequire = createRequire(rootRequire.resolve('vitest'));
const esbuild = createRequire(viteRequire.resolve('vite'))('esbuild');
const preconstructRequire = createRequire(
  rootRequire.resolve('@preconstruct/cli/package.json')
);
const { minify: terserMinify } = preconstructRequire('terser');

// Each profile is source code for a hypothetical app entry; what survives
// tree-shaking is what users actually pay for.
const PROFILES = {
  'fsm-logic': {
    capabilities: ['fsm', 'construction'],
    source: `
    import { createFSM } from 'xstate';
    const logic = createFSM({
      initial: 'inactive',
      states: {
        inactive: { on: { toggle: 'active' } },
        active: { on: { toggle: 'inactive' } }
      }
    });
    console.log(logic.transition(logic.initialState, { type: 'toggle' }).value);
  `
  },
  'fsm-entrypoint-logic': {
    capabilities: ['fsm', 'construction', 'subpath'],
    source: `
    import { createFSM } from 'xstate/fsm';
    const logic = createFSM({
      initial: 'inactive',
      states: {
        inactive: { on: { toggle: 'active' } },
        active: { on: { toggle: 'inactive' } }
      }
    });
    console.log(logic.transition(logic.initialState, { type: 'toggle' }).value);
  `
  },
  'minimal-machine': {
    capabilities: ['flat', 'actor'],
    source: `
    import { createMachine, createActor } from 'xstate';
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: { on: { toggle: 'active' } },
        active: { on: { toggle: 'inactive' } }
      }
    });
    const actor = createActor(machine).start();
    actor.send({ type: 'toggle' });
    console.log(actor.getSnapshot().value);
  `
  },
  'minimal-fsm': {
    capabilities: ['fsm', 'pure-transition', 'subpath'],
    source: `
    import { createFSM } from 'xstate/fsm';
    const machine = createFSM({
      initial: 'inactive',
      states: {
        inactive: { on: { toggle: 'active' } },
        active: { on: { toggle: 'inactive' } }
      }
    });
    console.log(machine.transition(machine.initialState, { type: 'toggle' }).value);
  `
  },
  'fsm-setup': {
    capabilities: ['fsm', 'setup', 'subpath'],
    source: `
    import { setup, types } from 'xstate/fsm';
    const app = setup({
      schemas: {
        events: { toggle: types() }
      }
    });
    const machine = app.createFSM({
      initial: 'inactive',
      states: {
        inactive: { on: { toggle: 'active' } },
        active: { on: { toggle: 'inactive' } }
      }
    });
    console.log(machine.transition(machine.initialState, { type: 'toggle' }).value);
  `
  },
  'custom-logic-actor': {
    capabilities: ['actor'],
    source: `
    import { createActor } from 'xstate';
    const initialSnapshot = {
      status: 'active',
      output: undefined,
      error: undefined,
      context: 0
    };
    const logic = {
      initialTransition: () => [initialSnapshot, []],
      transition: (snapshot, event) => [
        { ...snapshot, context: event.value },
        []
      ],
      getInitialSnapshot: () => initialSnapshot,
      getPersistedSnapshot: (snapshot) => snapshot
    };
    const actor = createActor(logic).start();
    actor.send({ type: 'set', value: 1 });
    console.log(actor.getSnapshot().context);
  `
  },
  'machine-construction': {
    capabilities: ['flat', 'construction'],
    source: `
    import { createMachine } from 'xstate';
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: { on: { toggle: 'active' } },
        active: { on: { toggle: 'inactive' } }
      }
    });
    console.log(machine.id);
  `
  },
  'pure-machine': {
    capabilities: ['flat', 'pure-transition'],
    source: `
    import { createMachine, initialTransition, transition } from 'xstate';
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: { on: { toggle: 'active' } },
        active: { on: { toggle: 'inactive' } }
      }
    });
    const [initialSnapshot] = initialTransition(machine);
    const [nextSnapshot] = transition(machine, initialSnapshot, {
      type: 'toggle'
    });
    console.log(nextSnapshot.value);
  `
  },
  compound: {
    capabilities: ['compound', 'actor'],
    source: `
    import { createMachine, createActor } from 'xstate';
    const machine = createMachine({
      initial: 'parent',
      states: {
        parent: {
          initial: 'inactive',
          states: {
            inactive: { on: { toggle: 'active' } },
            active: {}
          }
        }
      }
    });
    const actor = createActor(machine).start();
    actor.send({ type: 'toggle' });
    console.log(actor.getSnapshot().value);
  `
  },
  parallel: {
    capabilities: ['parallel', 'actor'],
    source: `
    import { createMachine, createActor } from 'xstate';
    const machine = createMachine({
      type: 'parallel',
      states: {
        left: {
          initial: 'inactive',
          states: { inactive: { on: { left: 'active' } }, active: {} }
        },
        right: {
          initial: 'inactive',
          states: { inactive: { on: { right: 'active' } }, active: {} }
        }
      }
    });
    const actor = createActor(machine).start();
    actor.send({ type: 'left' });
    console.log(actor.getSnapshot().value);
  `
  },
  history: {
    capabilities: ['compound', 'history', 'actor'],
    source: `
    import { createMachine, createActor } from 'xstate';
    const machine = createMachine({
      id: 'history-machine',
      initial: 'active',
      states: {
        active: {
          initial: 'first',
          states: {
            history: { type: 'history', target: 'first' },
            first: { on: { next: 'second' } },
            second: {}
          },
          on: { leave: 'inactive' }
        },
        inactive: { on: { restore: '#history-machine.active.history' } }
      }
    });
    const actor = createActor(machine).start();
    actor.send({ type: 'next' });
    actor.send({ type: 'leave' });
    actor.send({ type: 'restore' });
    console.log(actor.getSnapshot().value);
  `
  },
  final: {
    capabilities: ['final', 'actor'],
    source: `
    import { createMachine, createActor } from 'xstate';
    const machine = createMachine({
      initial: 'working',
      states: {
        working: { on: { finish: 'done' } },
        done: { type: 'final', output: { result: 'ok' } }
      }
    });
    const actor = createActor(machine).start();
    actor.send({ type: 'finish' });
    console.log(actor.getSnapshot().output);
  `
  },
  eventless: {
    capabilities: ['eventless', 'guard', 'actor'],
    source: `
    import { createMachine, createActor } from 'xstate';
    const machine = createMachine({
      context: { ready: true },
      initial: 'checking',
      states: {
        checking: {
          always: {
            guard: ({ context }) => context.ready,
            target: 'ready'
          }
        },
        ready: {}
      }
    });
    const actor = createActor(machine).start();
    console.log(actor.getSnapshot().value);
  `
  },
  actionful: {
    capabilities: ['action', 'context', 'actor'],
    source: `
    import { createMachine, createActor } from 'xstate';
    const machine = createMachine({
      context: { count: 0 },
      on: {
        increment: ({ context }, enq) => {
          enq(() => console.log('incremented'));
          return { context: { count: context.count + 1 } };
        }
      }
    });
    const actor = createActor(machine).start();
    actor.send({ type: 'increment' });
    console.log(actor.getSnapshot().context.count);
  `
  },
  invoked: {
    capabilities: ['invoke', 'async-logic', 'actor'],
    source: `
    import { createMachine, createActor, createAsyncLogic } from 'xstate';
    const request = createAsyncLogic({ run: async () => 'ok' });
    const machine = createMachine({
      initial: 'loading',
      states: {
        loading: {
          invoke: {
            src: request,
            onDone: ({ event }) => ({
              target: 'done',
              context: { result: event.output }
            })
          }
        },
        done: {}
      }
    });
    const actor = createActor(machine).start();
    await new Promise((resolve) => actor.subscribe((snapshot) => {
      if (snapshot.value === 'done') resolve();
    }));
    console.log(actor.getSnapshot().value);
  `
  },
  delayed: {
    capabilities: ['delay', 'actor'],
    source: `
    import { createMachine, createActor } from 'xstate';
    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: { after: { 1000: 'done' } },
        done: {}
      }
    });
    const actor = createActor(machine).start();
    await new Promise((resolve) => actor.subscribe((snapshot) => {
      if (snapshot.value === 'done') resolve();
    }));
    console.log(actor.getSnapshot().value);
  `
  },
  persisted: {
    capabilities: ['persistence', 'restore', 'actor'],
    source: `
    import { createMachine, createActor } from 'xstate';
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: { on: { toggle: 'active' } },
        active: {}
      }
    });
    const actor = createActor(machine).start();
    actor.send({ type: 'toggle' });
    const persisted = JSON.parse(JSON.stringify(actor.getPersistedSnapshot()));
    const restored = createActor(machine, { snapshot: persisted }).start();
    console.log(restored.getSnapshot().value);
  `
  },
  inspected: {
    capabilities: ['inspection', 'actor'],
    source: `
    import { createMachine, createActor } from 'xstate';
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: { on: { toggle: 'active' } },
        active: {}
      }
    });
    const actor = createActor(machine, {
      inspect: (event) => console.log(event.type)
    }).start();
    actor.send({ type: 'toggle' });
    console.log(actor.getSnapshot().value);
  `
  },
  'machine-and-actors': {
    capabilities: ['invoke', 'async-logic', 'actor'],
    source: `
    import { createMachine, createActor, createAsyncLogic } from 'xstate';
    const fetchUser = createAsyncLogic({
      run: async ({ input }) => ({ id: input.id })
    });
    const machine = createMachine({
      context: { user: null },
      initial: 'idle',
      states: {
        idle: { on: { load: 'loading' } },
        loading: {
          invoke: {
            src: fetchUser,
            input: { id: 1 },
            onDone: ({ event }) => ({
              target: 'loaded',
              context: { user: event.output }
            }),
            onError: 'failed'
          }
        },
        loaded: {},
        failed: {}
      }
    });
    const actor = createActor(machine).start();
    actor.send({ type: 'load' });
    await new Promise((resolve) => actor.subscribe((snapshot) => {
      if (snapshot.value === 'loaded') resolve();
    }));
    console.log(actor.getSnapshot().context.user.id);
  `
  },
  'validated-machine': {
    capabilities: ['validation', 'actor'],
    source: `
    import { setup, createActor } from 'xstate';
    import { standardSchemaValidator } from 'xstate/validation';
    const countSchema = {
      '~standard': {
        version: 1,
        vendor: 'fixture',
        validate(value) {
          return typeof value.count === 'number'
            ? { value }
            : { issues: [{ message: 'Expected count' }] };
        }
      }
    };
    const machine = setup({
      validator: standardSchemaValidator(),
      schemas: { events: { increment: countSchema } }
    }).createMachine({ context: { count: 0 } });
    const actor = createActor(machine).start();
    actor.send({ type: 'increment', count: 1 });
    console.log(actor.getSnapshot().context.count);
  `
  },
  'store-counter': {
    capabilities: ['store'],
    source: `
      import { createStore } from '@xstate/store';
      const store = createStore({ context: { count: 0 }, on: { increment: (context) => ({ count: context.count + 1 }) } });
      store.trigger.increment();
      console.log(store.getSnapshot().context.count);
    `
  },
  'store-atom': {
    capabilities: ['store', 'atom'],
    source: `
      import { createAtom } from '@xstate/store';
      const atom = createAtom(0);
      atom.set(1);
      console.log(atom.get());
    `
  },
  'react-machine': {
    capabilities: ['react', 'actor', 'ssr'],
    external: ['react', 'react-dom/server'],
    source: `
      import { createElement } from 'react';
      import { renderToString } from 'react-dom/server';
      import { createMachine } from 'xstate';
      import { useActorRef, useSelector } from '@xstate/react';
      const machine = createMachine({ initial: 'inactive', states: { inactive: {}, active: {} } });
      function App() {
        const actor = useActorRef(machine);
        const state = useSelector(actor, (snapshot) => snapshot.value);
        return createElement('span', null, state);
      }
      console.log(renderToString(createElement(App)));
    `
  },
  'react-store': {
    capabilities: ['react', 'store', 'ssr'],
    external: ['react', 'react-dom/server'],
    source: `
      import { createElement } from 'react';
      import { renderToString } from 'react-dom/server';
      import { useStore, useSelector } from '@xstate/store-react';
      function App() {
        const store = useStore({ context: { count: 1 }, on: {} });
        const count = useSelector(store, (snapshot) => snapshot.context.count);
        return createElement('span', null, count);
      }
      console.log(renderToString(createElement(App)));
    `
  },
  'kitchen-sink': {
    capabilities: ['all-exports'],
    source: `
    export * from 'xstate';
  `
  }
};

const EXPECTED_LOGS = {
  'fsm-logic': [['active']],
  'fsm-entrypoint-logic': [['active']],
  'minimal-machine': [['active']],
  'minimal-fsm': [['active']],
  'fsm-setup': [['active']],
  'custom-logic-actor': [[1]],
  'machine-construction': [['(machine)']],
  'pure-machine': [['active']],
  compound: [[{ parent: 'active' }]],
  parallel: [[{ left: 'active', right: 'inactive' }]],
  history: [[{ active: 'second' }]],
  final: [[{ result: 'ok' }]],
  eventless: [['ready']],
  actionful: [['incremented'], [1]],
  invoked: [['done']],
  delayed: [['done']],
  persisted: [['active']],
  inspected: [
    ['@xstate.actor'],
    ['@xstate.transition'],
    ['@xstate.transition'],
    ['active']
  ],
  'machine-and-actors': [[1]],
  'validated-machine': [[0]],
  'store-counter': [[1]],
  'store-atom': [[1]],
  'react-machine': [['<span>inactive</span>']],
  'react-store': [['<span>1</span>']],
  'kitchen-sink': []
};

const args = process.argv.slice(2);
const update = args.includes('--update');
const why = args.includes('--why');
const json = args.includes('--json');
const useDist = args.includes('--dist');
const verify = args.includes('--verify');
const report = args.includes('--report');
const experiment = args.includes('--experiment=lazy-bind');
const baselineArg = args.find((arg) => arg.startsWith('--baseline='));
const baseline = baselineArg
  ? execFileSync(
      'git',
      [
        'rev-parse',
        '--verify',
        baselineArg.slice('--baseline='.length) + '^{commit}'
      ],
      { cwd: root, encoding: 'utf8' }
    ).trim()
  : undefined;
if (baseline && (!report || useDist || experiment)) {
  throw new Error(
    'A source baseline requires --report without --dist or an experiment'
  );
}
if (experiment && (!report || useDist)) {
  throw new Error(
    'The lazy-bind experiment requires --report and source input'
  );
}
const attribution = {};
const profileArg = args.find((arg) => arg.startsWith('--profile='));
const selectedProfile = profileArg?.slice('--profile='.length);
const thresholdsPath = join(root, 'scripts', 'bundle-size.thresholds.json');

if (selectedProfile && !PROFILES[selectedProfile]) {
  throw new Error(`Unknown profile: ${selectedProfile}`);
}
if (update && report) {
  throw new Error('--update cannot be combined with --report');
}
if (update && selectedProfile) {
  throw new Error('--update cannot be combined with --profile');
}
if (update && useDist) {
  throw new Error('--update cannot be combined with --dist');
}

// Dev-only branches are folded the way the production dist build does it.
const sourcePlugin = {
  name: 'fold-is-development',
  setup(build) {
    build.onResolve({ filter: /^#is-development$/ }, () => ({
      path: join(root, 'packages', 'core', 'src', 'false.ts')
    }));
    build.onLoad({ filter: /packages\/[^/]+\/src\/.*\.ts$/ }, async (args) => {
      const { readFile } = await import('node:fs/promises');
      let src = baseline
        ? execFileSync(
            'git',
            ['show', `${baseline}:${args.path.slice(root.length + 1)}`],
            { cwd: root, encoding: 'utf8' }
          )
        : await readFile(args.path, 'utf8');
      const developmentImport =
        /import isDevelopment from ['"]#is-development['"];?/;
      if (developmentImport.test(src)) {
        src = src
          .replace(developmentImport, '')
          .replace(/\bisDevelopment\b/g, 'false');
      }
      if (experiment && args.path.endsWith('/StateMachine.ts')) {
        src = lazyBindingsExperiment(src);
      }
      return { contents: src, loader: 'ts' };
    });
  }
};

const results = {};
// Keep verification artifacts beneath the workspace so external framework imports
// resolve identically to an application without including their bytes.
const cacheDir = join(root, 'node_modules', '.cache');
mkdirSync(cacheDir, { recursive: true });
const workDir = mkdtempSync(join(cacheDir, 'xstate-size-'));
// Framework peers are installed in the adapter workspace under pnpm.
const adapterRequire = createRequire(
  join(root, 'packages/xstate-react/package.json')
);
mkdirSync(join(workDir, 'node_modules'));
for (const peer of ['react', 'react-dom']) {
  symlinkSync(
    dirname(adapterRequire.resolve(`${peer}/package.json`)),
    join(workDir, 'node_modules', peer),
    'dir'
  );
}

try {
  if (useDist) {
    mkdirSync(join(workDir, 'node_modules', '@xstate'));
    for (const [name, directory] of Object.entries({
      xstate: 'core',
      '@xstate/store': 'xstate-store',
      '@xstate/store-react': 'xstate-store-react',
      '@xstate/react': 'xstate-react'
    })) {
      symlinkSync(
        join(root, 'packages', directory),
        join(workDir, 'node_modules', name),
        'dir'
      );
    }
  }
  for (const [name, profile] of Object.entries(PROFILES)) {
    if (selectedProfile && name !== selectedProfile) {
      continue;
    }
    const entry = join(workDir, `${name}.js`);
    writeFileSync(entry, profile.source);
    const buildOptions = {
      entryPoints: [entry],
      bundle: true,
      format: 'esm',
      write: false,
      // Source is canonical. Dist is an explicit post-build diagnostic only.
      alias: useDist
        ? undefined
        : {
            '@xstate/store-react': join(
              root,
              'packages',
              'xstate-store-react',
              'src',
              'index.ts'
            ),
            '@xstate/store': join(
              root,
              'packages',
              'xstate-store',
              'src',
              'index.ts'
            ),
            '@xstate/react': join(
              root,
              'packages',
              'xstate-react',
              'src',
              'index.ts'
            ),
            'xstate/fsm': join(
              root,
              'packages',
              'core',
              'src',
              'fsm',
              'index.ts'
            ),
            'xstate/validation': join(
              root,
              'packages',
              'core',
              'src',
              'validation',
              'index.ts'
            ),
            xstate: join(root, 'packages', 'core', 'src', 'index.ts')
          },
      conditions: ['module'],
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: useDist ? [] : [sourcePlugin],
      external: profile.external ?? []
    };
    const built = await esbuild.build({
      ...buildOptions,
      minify: true,
      metafile: why
    });
    const code = built.outputFiles[0].contents;
    const unminified = await esbuild.build({
      ...buildOptions,
      minify: false
    });
    const terserResult = await terserMinify(unminified.outputFiles[0].text, {
      module: true,
      compress: { passes: 2 },
      mangle: true,
      format: { comments: false }
    });
    if (!terserResult.code) {
      throw new Error(`Terser emitted no code for profile "${name}"`);
    }
    const terserCode = Buffer.from(terserResult.code);
    if (verify) {
      for (const [minifier, measuredCode] of [
        ['esbuild', code],
        ['terser', terserCode]
      ]) {
        verifyBundle({
          name: `${name}-${minifier}`,
          directory: workDir,
          code: measuredCode,
          expectedLogs: EXPECTED_LOGS[name],
          exports:
            name === 'kitchen-sink'
              ? ['createMachine', 'createActor', 'createFSM']
              : []
        });
      }
    }
    results[name] = {
      minified: code.byteLength,
      gzipped: gzip(code, { level: 9 }).byteLength,
      terserMinified: terserCode.byteLength,
      terserGzipped: gzip(terserCode, { level: 9 }).byteLength,
      capabilities: profile.capabilities,
      external: profile.external ?? [],
      profileHash: createHash('sha256')
        .update(profile.source)
        .digest('hex')
        .slice(0, 16),
      verified: verify
    };
    if (why) {
      if (!json) console.log(`\n${name} — minified bytes per module:`);
      const inputs = Object.values(built.metafile.outputs)[0].inputs;
      const rows = Object.entries(inputs)
        .map(([file, { bytesInOutput }]) => [
          file
            .replace(/^.*packages\/core\/src\//, '')
            .replace(
              /node_modules\/\.cache\/xstate-size-[^/]+\//,
              '<profile>/'
            ),
          bytesInOutput
        ])
        .filter(([, bytes]) => bytes > 0)
        .sort((a, b) => b[1] - a[1]);
      attribution[name] = Object.fromEntries(rows);
      if (!json) {
        for (const [file, bytes] of rows) {
          console.log(`  ${String(bytes).padStart(8)}  ${file}`);
        }
      }
    }
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
  esbuild.stop();
}

const kb = (n) => `${(n / 1024).toFixed(2)} kB`;

if (json) {
  console.log(
    JSON.stringify({
      source: useDist ? 'dist' : 'src',
      node: process.version,
      experiment: experiment ? 'lazy-bind' : null,
      baseline: baseline ?? null,
      esbuild: esbuild.version,
      terser: preconstructRequire('terser/package.json').version,
      pako: rootRequire('pako/package.json').version,
      lockfileHash: createHash('sha256')
        .update(readFileSync(join(root, 'pnpm-lock.yaml')))
        .digest('hex'),
      results,
      ...(why ? { attribution } : {})
    })
  );
} else {
  console.log(
    `xstate bundle size (min+gzip), bundled from ${useDist ? 'packages/core/dist' : 'packages/core/src'}:\n`
  );
  const nameWidth = Math.max(
    ...Object.keys(results).map((name) => name.length)
  );
  for (const [name, { minified, gzipped }] of Object.entries(results)) {
    console.log(
      `  ${name.padEnd(nameWidth)} esbuild min ${kb(minified).padStart(10)}   gz ${kb(gzipped).padStart(9)}`
    );
    const result = results[name];
    console.log(
      `  ${''.padEnd(nameWidth)}  terser min ${kb(result.terserMinified).padStart(10)}   gz ${kb(result.terserGzipped).padStart(9)}`
    );
  }

  if (!selectedProfile && results['minimal-machine']) {
    const baseline = results['minimal-machine'].gzipped;
    console.log(
      '\nWhole-profile gzip deltas from minimal-machine (not additive):'
    );
    for (const [name, result] of Object.entries(results)) {
      if (name === 'minimal-machine') {
        continue;
      }
      const delta = result.gzipped - baseline;
      const sign = delta >= 0 ? '+' : '';
      console.log(
        `  ${name.padEnd(nameWidth)} ${`${sign}${delta} B`.padStart(9)}  ${result.capabilities.join(', ')}`
      );
    }
  }
}

if (update) {
  const thresholds = {};
  for (const [name, { gzipped }] of Object.entries(results)) {
    // The source bundle is deterministic. Require every increase to be
    // reviewed and explicitly accepted rather than hiding it in headroom.
    thresholds[name] = { maxGzipBytes: gzipped };
  }
  writeFileSync(thresholdsPath, JSON.stringify(thresholds, null, 2) + '\n');
  if (!json) {
    console.log(`\nThresholds updated: ${thresholdsPath}`);
  }
  process.exit(0);
}

if (useDist || report) {
  if (!json) {
    console.log('\nInformational report; source thresholds were not checked.');
  }
  process.exit(0);
}

let failed = false;
const thresholds = JSON.parse(readFileSync(thresholdsPath, 'utf8'));
for (const [name, { gzipped }] of Object.entries(results)) {
  const max = thresholds[name]?.maxGzipBytes;
  if (max === undefined) {
    console.error(`\nNo threshold for profile "${name}" — run with --update.`);
    failed = true;
  } else if (gzipped > max) {
    console.error(
      `\nFAIL ${name}: ${gzipped} bytes gz exceeds threshold ${max}.` +
        ` If intentional, rerun with --update and commit the result.`
    );
    failed = true;
  }
}
if (!failed && !json) console.log('\nAll profiles within thresholds.');
process.exit(failed ? 1 : 0);
