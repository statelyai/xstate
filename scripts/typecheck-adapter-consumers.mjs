// Typechecks a consumer that imports the adapters' *built* type declarations
// under `exactOptionalPropertyTypes: true` (tsconfig.exact-optional.json).
//
// This needs its own tsconfig because one `tsc` run applies one set of compiler
// options, and the rest of the repo is checked without that flag.
//
// It is deliberately not part of `pnpm typecheck`: the fixture imports
// `packages/*/dist/*.cjs.mjs` on purpose, so what it checks is the published
// type surface rather than `src`. That means it only says anything true about a
// built tree, while the normal dev loop runs on `preconstruct dev` redirect
// files (see "Building" in CONTRIBUTING.md). CI runs it next to the other
// built-artifact checks, straight after `pnpm build`.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The packages the fixture imports built declarations from. */
const required = [
  'packages/core',
  'packages/xstate-react',
  'packages/xstate-solid',
  'packages/xstate-svelte',
  'packages/xstate-vue'
];

/**
 * Newest and oldest mtime under `directory`, or undefined when it has no files.
 *
 * @param {string} directory
 */
function mtimeRange(directory) {
  if (!existsSync(directory)) return undefined;
  let newest;
  let oldest;
  /** @param {string} current */
  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(target);
        continue;
      }
      const { mtimeMs } = statSync(target);
      if (newest === undefined || mtimeMs > newest) newest = mtimeMs;
      if (oldest === undefined || mtimeMs < oldest) oldest = mtimeMs;
    }
  }
  walk(directory);
  return newest === undefined ? undefined : { newest, oldest };
}

const unbuilt = [];
const stale = [];

for (const pkg of required) {
  // `dist/declarations/` is written by `preconstruct build` and by nothing
  // else, which makes it a reliable marker for "this package has been built".
  const declarations = mtimeRange(path.join(root, pkg, 'dist', 'declarations'));
  if (!declarations) {
    unbuilt.push(pkg);
    continue;
  }
  // Declarations generated before the last source edit describe code that is no
  // longer there, so checking them would pass over a real regression.
  const sources = mtimeRange(path.join(root, pkg, 'src'));
  if (sources && sources.newest > declarations.oldest) stale.push(pkg);
}

if (unbuilt.length > 0 || stale.length > 0) {
  const describe = (
    /** @type {string[]} */ pkgs,
    /** @type {string} */ label
  ) =>
    pkgs.length > 0
      ? `${label}\n${pkgs.map((p) => `  ${p}`).join('\n')}\n`
      : '';
  console.error(
    'Cannot typecheck adapter consumers against current sources.\n\n' +
      describe(unbuilt, 'Not built yet:') +
      describe(stale, 'Built, but the sources changed since:') +
      '\nThis check compiles the adapters’ published declarations, not their\n' +
      'source. Run `pnpm build` first, then try again. (`pnpm postinstall`\n' +
      'restores the dev redirect files afterwards.)'
  );
  process.exit(1);
}

try {
  execFileSync('npx', ['tsc', '-p', 'tsconfig.exact-optional.json'], {
    cwd: root,
    stdio: 'inherit'
  });
} catch {
  process.exit(1);
}
