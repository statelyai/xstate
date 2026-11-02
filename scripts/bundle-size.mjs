// Bundle-size measurement for XState, stores, and representative adapters.
//
// Bundles each entry profile below from source with esbuild, minifies it with
// esbuild and with Terser, and prints minified and min+gzip byte counts. It only
// measures: there are no thresholds and it never fails on size.
//
// Usage:
//   node scripts/bundle-size.mjs                          # all profiles
//   node scripts/bundle-size.mjs --profile=minimal-machine
//   node scripts/bundle-size.mjs --why                    # per-module bytes
//   node scripts/bundle-size.mjs --json                   # machine-readable
//
// esbuild is resolved through vite's dependency graph so this script adds no
// new dependency to the repo.

import { createRequire } from 'node:module';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// Node links against different zlib versions across platforms and releases;
// pako (pure JS) keeps gzip sizes reproducible.
import { gzip } from 'pako';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// pnpm doesn't hoist esbuild to the root, so resolve it through the
// dependency chain root -> vitest -> vite -> esbuild (Node resolves through
// the .pnpm symlinks to real paths).
const rootRequire = createRequire(join(root, 'package.json'));
const viteRequire = createRequire(rootRequire.resolve('vitest'));
const esbuild = createRequire(viteRequire.resolve('vite'))('esbuild');
const preconstructRequire = createRequire(
  rootRequire.resolve('@preconstruct/cli/package.json')
);
const { minify: terserMinify } = preconstructRequire('terser');

// Each profile is source code for a hypothetical app entry; what survives
// tree-shaking is what users actually pay for.
const PROFILES = {
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
    console.log(logic.transition(logic.initialState, { type: 'toggle' })[0].value);
  `
  },
  'minimal-machine': {
    capabilities: ['flat', 'actor'],
    source: `
    import { createMachine, createActor } from 'xstate';
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: { on: { toggle: { target: 'active' } } },
        active: { on: { toggle: { target: 'inactive' } } }
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
    console.log(machine.transition(machine.initialState, { type: 'toggle' })[0].value);
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
    console.log(machine.transition(machine.initialState, { type: 'toggle' })[0].value);
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
        inactive: { on: { toggle: { target: 'active' } } },
        active: { on: { toggle: { target: 'inactive' } } }
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
        inactive: { on: { toggle: { target: 'active' } } },
        active: { on: { toggle: { target: 'inactive' } } }
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
            inactive: { on: { toggle: { target: 'active' } } },
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
          states: { inactive: { on: { left: { target: 'active' } } }, active: {} }
        },
        right: {
          initial: 'inactive',
          states: { inactive: { on: { right: { target: 'active' } } }, active: {} }
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
            first: { on: { next: { target: 'second' } } },
            second: {}
          },
          on: { leave: { target: 'inactive' } }
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
        working: { on: { finish: { target: 'done' } } },
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
        waiting: { after: { 1000: { target: 'done' } } },
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
        inactive: { on: { toggle: { target: 'active' } } },
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
        inactive: { on: { toggle: { target: 'active' } } },
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
        idle: { on: { load: { target: 'loading' } } },
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
  'store-source-atom': {
    capabilities: ['store', 'atom', 'external-source'],
    source: `
      import { createAtom, createSourceAtom } from '@xstate/store';
      let value = 0;
      let notify;
      const source = createSourceAtom({
        getSnapshot: () => value,
        subscribe: (listener) => {
          notify = listener;
          return { unsubscribe() { notify = undefined; } };
        }
      });
      const derived = createAtom(() => source.get() * 2);
      const subscription = derived.subscribe(() => {});
      value = 1;
      notify();
      console.log(derived.get());
      subscription.unsubscribe();
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

const args = process.argv.slice(2);
const why = args.includes('--why');
const json = args.includes('--json');
const profileArg = args.find((arg) => arg.startsWith('--profile='));
const selectedProfile = profileArg?.slice('--profile='.length);
if (selectedProfile && !PROFILES[selectedProfile]) {
  throw new Error(`Unknown profile: ${selectedProfile}`);
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
      let src = await readFile(args.path, 'utf8');
      const developmentImport =
        /import isDevelopment from ['"]#is-development['"];?/;
      if (developmentImport.test(src)) {
        src = src
          .replace(developmentImport, '')
          .replace(/\bisDevelopment\b/g, 'false');
      }
      return { contents: src, loader: 'ts' };
    });
  }
};

const results = {};
const attribution = {};
// Keep build entries beneath the workspace so external framework imports
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

const src = (...path) => join(root, 'packages', ...path);

try {
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
      alias: {
        '@xstate/store-react': src('xstate-store-react', 'src', 'index.ts'),
        '@xstate/store': src('xstate-store', 'src', 'index.ts'),
        '@xstate/react': src('xstate-react', 'src', 'index.ts'),
        'xstate/fsm': src('core', 'src', 'fsm', 'index.ts'),
        'xstate/validation': src('core', 'src', 'validation', 'index.ts'),
        xstate: src('core', 'src', 'index.ts')
      },
      conditions: ['module'],
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [sourcePlugin],
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
    results[name] = {
      minified: code.byteLength,
      gzipped: gzip(code, { level: 9 }).byteLength,
      terserMinified: terserCode.byteLength,
      terserGzipped: gzip(terserCode, { level: 9 }).byteLength,
      capabilities: profile.capabilities
    };
    if (why) {
      const inputs = Object.values(built.metafile.outputs)[0].inputs;
      attribution[name] = Object.fromEntries(
        Object.entries(inputs)
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
          .sort((a, b) => b[1] - a[1])
      );
    }
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
  esbuild.stop();
}

if (json) {
  console.log(
    JSON.stringify({
      node: process.version,
      esbuild: esbuild.version,
      terser: preconstructRequire('terser/package.json').version,
      pako: rootRequire('pako/package.json').version,
      results,
      ...(why ? { attribution } : {})
    })
  );
} else {
  const rows = [
    ['profile', 'esbuild min', 'esbuild gz', 'terser min', 'terser gz'],
    ...Object.entries(results).map(([name, r]) => [
      name,
      r.minified,
      r.gzipped,
      r.terserMinified,
      r.terserGzipped
    ])
  ];
  const widths = rows[0].map((_, i) =>
    Math.max(...rows.map((row) => String(row[i]).length))
  );
  console.log('Bundle size in bytes, bundled from packages/*/src:\n');
  for (const row of rows) {
    console.log(
      row
        .map((cell, i) =>
          i === 0
            ? String(cell).padEnd(widths[i])
            : String(cell).padStart(widths[i])
        )
        .join('  ')
    );
  }
  for (const [name, modules] of Object.entries(attribution)) {
    console.log(`\n${name}: esbuild minified bytes per module`);
    for (const [file, bytes] of Object.entries(modules)) {
      console.log(`  ${String(bytes).padStart(8)}  ${file}`);
    }
  }
}
