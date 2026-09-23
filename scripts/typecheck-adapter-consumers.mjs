// Typechecks a consumer that imports the adapters' *built* type declarations
// under `exactOptionalPropertyTypes: true` (tsconfig.exact-optional.json).
//
// This needs its own tsconfig because one `tsc` run applies one set of compiler
// options, and the rest of the repo is checked without that flag. It also needs
// `pnpm build` first: the fixture imports `packages/*/dist/*.cjs.mjs` on
// purpose, so that what is checked is the published type surface rather than
// `src`. `preconstruct dev` only writes redirect files, so without a build the
// same run would check the adapters' sources and report errors that consumers
// never see.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
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

// `dist/declarations/` is written by `preconstruct build` and by nothing else,
// which makes it a reliable marker for "this package has been built".
const unbuilt = required.filter(
  (pkg) => !existsSync(path.join(root, pkg, 'dist', 'declarations'))
);

if (unbuilt.length > 0) {
  console.error(
    'Cannot typecheck adapter consumers: these packages are not built yet:\n' +
      unbuilt.map((pkg) => `  ${pkg}`).join('\n') +
      '\n\nThis check compiles the adapters’ published declarations, not their\n' +
      'source. Run `pnpm build` first, then try again.'
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
