// Bundle-size benchmark for the `xstate` package.
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
//   node scripts/bundle-size.mjs --verify   # execute every bundled profile
//
// Source is canonical so the gate cannot accidentally measure stale build
// artifacts. `--dist` requires `preconstruct build` to have run first.
// esbuild is resolved through vite's dependency graph so this script adds no
// new dependency to the repo.

import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
        inactive: { on: { toggle: { target: 'active' } } },
        active: { on: { toggle: { target: 'inactive' } } }
      }
    });
    console.log(logic.id);
  `
  },
  'fsm-entrypoint-logic': {
    capabilities: ['fsm', 'construction', 'subpath'],
    source: `
    import { createFSM } from 'xstate/fsm';
    const logic = createFSM({
      initial: 'inactive',
      states: {
        inactive: { on: { toggle: { target: 'active' } } },
        active: { on: { toggle: { target: 'inactive' } } }
      }
    });
    console.log(logic.id);
  `
  },
  'fsm-entrypoint-actor': {
    capabilities: ['fsm', 'actor', 'subpath'],
    source: `
    import { createFSM, createFSMActor } from 'xstate/fsm';
    const logic = createFSM({
      initial: 'inactive',
      states: {
        inactive: { on: { toggle: { target: 'active' } } },
        active: { on: { toggle: { target: 'inactive' } } }
      }
    });
    const actor = createFSMActor(logic).start();
    actor.send({ type: 'toggle' });
    console.log(actor.getSnapshot().value);
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
    capabilities: ['fsm', 'actor'],
    source: `
    import { createFSM, createActor } from 'xstate';
    const machine = createFSM({
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
    const persisted = actor.getPersistedSnapshot();
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
      run: ({ input }) => fetch('/u/' + input.id).then((r) => r.json())
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
    console.log(actor.getSnapshot().value);
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
  'kitchen-sink': {
    capabilities: ['all-exports'],
    source: `
    export * from 'xstate';
  `
  }
};

const args = process.argv.slice(2);
const update = args.includes('--update');
const why = args.includes('--why');
const json = args.includes('--json');
const useDist = args.includes('--dist');
const verify = args.includes('--verify');
const profileArg = args.find((arg) => arg.startsWith('--profile='));
const selectedProfile = profileArg?.slice('--profile='.length);
const thresholdsPath = join(root, 'scripts', 'bundle-size.thresholds.json');

if (selectedProfile && !PROFILES[selectedProfile]) {
  throw new Error(`Unknown profile: ${selectedProfile}`);
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
    build.onLoad({ filter: /packages\/core\/src\/.*\.ts$/ }, async (args) => {
      const { readFile } = await import('node:fs/promises');
      let src = await readFile(args.path, 'utf8');
      src = src.replace(
        /import isDevelopment from ['"]#is-development['"];?/,
        ''
      );
      src = src.replace(/\bisDevelopment\b/g, 'false');
      return { contents: src, loader: 'ts' };
    });
  }
};

const results = {};
const workDir = mkdtempSync(join(tmpdir(), 'xstate-size-'));

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
      // Source is canonical. Dist is an explicit post-build diagnostic only.
      alias: {
        'xstate/fsm': useDist
          ? join(root, 'packages', 'core', 'fsm')
          : join(root, 'packages', 'core', 'src', 'fsm', 'index.ts'),
        'xstate/validation': useDist
          ? join(root, 'packages', 'core', 'validation')
          : join(root, 'packages', 'core', 'src', 'validation', 'index.ts'),
        xstate: useDist
          ? join(root, 'packages', 'core')
          : join(root, 'packages', 'core', 'src', 'index.ts')
      },
      conditions: ['module'],
      plugins: useDist ? [] : [sourcePlugin],
      external: []
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
      const executable = join(workDir, `${name}.mjs`);
      writeFileSync(executable, code);
      const execution = spawnSync(process.execPath, [executable], {
        encoding: 'utf8',
        timeout: 5_000
      });
      if (execution.status !== 0) {
        throw new Error(
          `Profile "${name}" failed to execute:\n${execution.stderr || execution.stdout}`
        );
      }
    }
    results[name] = {
      minified: code.byteLength,
      gzipped: gzip(code, { level: 9 }).byteLength,
      terserMinified: terserCode.byteLength,
      terserGzipped: gzip(terserCode, { level: 9 }).byteLength,
      capabilities: profile.capabilities
    };
    if (why) {
      console.log(`\n${name} — minified bytes per module:`);
      const inputs = Object.values(built.metafile.outputs)[0].inputs;
      const rows = Object.entries(inputs)
        .map(([file, { bytesInOutput }]) => [
          file.replace(/^.*packages\/core\/src\//, ''),
          bytesInOutput
        ])
        .filter(([, bytes]) => bytes > 0)
        .sort((a, b) => b[1] - a[1]);
      for (const [file, bytes] of rows) {
        console.log(`  ${String(bytes).padStart(8)}  ${file}`);
      }
    }
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
  esbuild.stop();
}

const kb = (n) => `${(n / 1024).toFixed(2)} kB`;

if (json) {
  console.log(JSON.stringify({ source: useDist ? 'dist' : 'src', results }));
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

if (useDist) {
  if (!json) {
    console.log(
      '\nDist is diagnostic only; source thresholds were not checked.'
    );
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
