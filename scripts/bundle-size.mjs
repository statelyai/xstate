// Bundle-size benchmark for the `xstate` package.
//
// Measures min+gzip size of three entry profiles bundled from the local build
// (`packages/core/dist`), compares them against the thresholds in
// scripts/bundle-size.thresholds.json, and exits non-zero on regression.
//
// Usage:
//   node scripts/bundle-size.mjs            # measure + check thresholds
//   node scripts/bundle-size.mjs --update   # rewrite thresholds to current sizes
//   node scripts/bundle-size.mjs --why      # per-module byte attribution (from src)
//
// Requires `preconstruct build` to have run first (CI does this).
// esbuild is resolved through vite's dependency graph so this script adds no
// new dependency to the repo.

import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// pnpm doesn't hoist esbuild to the root, so resolve it through the
// dependency chain root -> vitest -> vite -> esbuild (Node resolves through
// the .pnpm symlinks to real paths).
const rootRequire = createRequire(join(root, 'package.json'));
const viteRequire = createRequire(rootRequire.resolve('vitest'));
const esbuild = createRequire(viteRequire.resolve('vite'))('esbuild');

// Each profile is source code for a hypothetical app entry; what survives
// tree-shaking is what users actually pay for.
const PROFILES = {
  'minimal-machine': `
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
  `,
  'machine-and-actors': `
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
  `,
  'kitchen-sink': `
    export * from 'xstate';
  `
};

const args = process.argv.slice(2);
const update = args.includes('--update');
const why = args.includes('--why');
const thresholdsPath = join(root, 'scripts', 'bundle-size.thresholds.json');

// `--why` bundles from src (per-module attribution; dist chunks are too
// coarse). Dev-only branches are folded the way the prod dist build does it,
// so the totals track the dist profiles closely.
const whyPlugin = {
  name: 'fold-is-development',
  setup(build) {
    build.onResolve({ filter: /^#is-development$/ }, () => ({
      path: join(root, 'packages', 'core', 'src', 'false.ts')
    }));
    build.onLoad({ filter: /packages\/core\/src\/.*\.ts$/ }, async (args) => {
      const { readFile } = await import('node:fs/promises');
      let src = await readFile(args.path, 'utf8');
      src = src.replace(/import isDevelopment from ['"]#is-development['"];?/, '');
      src = src.replace(/\bisDevelopment\b/g, 'false');
      return { contents: src, loader: 'ts' };
    });
  }
};

const results = {};
const workDir = mkdtempSync(join(tmpdir(), 'xstate-size-'));

try {
  for (const [name, source] of Object.entries(PROFILES)) {
    const entry = join(workDir, `${name}.js`);
    writeFileSync(entry, source);
    const built = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      minify: true,
      format: 'esm',
      write: false,
      metafile: why,
      // Resolve 'xstate' to the locally built package (or src for --why).
      alias: {
        xstate: why
          ? join(root, 'packages', 'core', 'src', 'index.ts')
          : join(root, 'packages', 'core')
      },
      conditions: ['module'],
      plugins: why ? [whyPlugin] : [],
      external: []
    });
    const code = built.outputFiles[0].contents;
    results[name] = {
      minified: code.byteLength,
      gzipped: gzipSync(code, { level: 9 }).byteLength
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
}

const kb = (n) => `${(n / 1024).toFixed(2)} kB`;

console.log('xstate bundle size (min+gzip), built from packages/core/dist:\n');
for (const [name, { minified, gzipped }] of Object.entries(results)) {
  console.log(
    `  ${name.padEnd(20)} min ${kb(minified).padStart(10)}   gz ${kb(gzipped).padStart(9)}`
  );
}

if (update) {
  const thresholds = {};
  for (const [name, { gzipped }] of Object.entries(results)) {
    // 3% headroom over current size so unrelated PRs don't flake.
    thresholds[name] = { maxGzipBytes: Math.ceil(gzipped * 1.03) };
  }
  writeFileSync(thresholdsPath, JSON.stringify(thresholds, null, 2) + '\n');
  console.log(`\nThresholds updated: ${thresholdsPath}`);
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
if (!failed) console.log('\nAll profiles within thresholds.');
process.exit(failed ? 1 : 0);
