import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const consumer = mkdtempSync(join(tmpdir(), 'xstate-effect-oxlint-'));
const node = process.env.EFFECT_OXLINT_NODE || process.execPath;

function run(command, args, cwd = consumer) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
}

try {
  const tarballs = ['core', 'xstate-effect'].map((directory) => {
    const before = new Set(readdirSync(consumer));
    run(
      'pnpm',
      ['pack', '--pack-destination', consumer],
      join(root, 'packages', directory)
    );
    const tarball = readdirSync(consumer).find((file) => !before.has(file));
    assert.ok(tarball, `No tarball for ${directory}. Run pnpm build first.`);
    return join(consumer, tarball);
  });

  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      name: 'effect-oxlint-consumer',
      private: true,
      type: 'module'
    })
  );
  run('npm', [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    ...tarballs,
    'effect@4.0.6',
    'typescript@npm:@typescript/typescript6@6.0.2'
  ]);

  const packageDir = join(consumer, 'node_modules/@xstate/effect');
  const manifest = JSON.parse(
    readFileSync(join(packageDir, 'package.json'), 'utf8')
  );
  assert.deepEqual(manifest.dependencies ?? {}, {});
  assert.deepEqual(manifest.optionalDependencies ?? {}, {});
  assert.deepEqual(
    Object.keys(manifest.peerDependencies)
      .filter(
        (name) => manifest.peerDependenciesMeta?.[name]?.optional !== true
      )
      .sort(),
    ['effect', 'xstate']
  );
  assert.equal(manifest.peerDependencies['@oxlint/plugins'], '^1.76.0');
  assert.equal(manifest.peerDependenciesMeta['@oxlint/plugins'].optional, true);
  assert.ok(!existsSync(join(consumer, 'node_modules/@oxlint/plugins')));
  const lock = JSON.parse(
    readFileSync(join(consumer, 'package-lock.json'), 'utf8')
  );
  assert.ok(
    !Object.keys(lock.packages).some((name) =>
      name.endsWith('node_modules/@oxlint/plugins')
    )
  );
  assert.ok(
    !readdirSync(packageDir).includes('src'),
    'Consumer must use compiled files'
  );

  writeFileSync(
    join(consumer, 'runtime.ts'),
    `import { setupEffect } from '@xstate/effect';
export { setupEffect };
`
  );
  const compilerOptions = {
    target: 'ES2024',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    strict: true,
    skipLibCheck: false,
    declaration: true,
    emitDeclarationOnly: true,
    types: [],
    outDir: 'declarations'
  };
  writeFileSync(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({ compilerOptions, files: ['runtime.ts'] })
  );
  run(node, ['node_modules/typescript/bin/tsc6', '--pretty', 'false']);
  writeFileSync(
    join(consumer, 'reject-tooling.mjs'),
    `export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@oxlint/') || specifier.endsWith('/oxlint') || specifier.endsWith('/xstate-effect-oxlint.js')) {
    throw new Error('Runtime entry imported tooling: ' + specifier);
  }
  return nextResolve(specifier, context);
}
`
  );
  writeFileSync(
    join(consumer, 'runtime.mjs'),
    `import { setupEffect } from '@xstate/effect';
if (typeof setupEffect !== 'function') throw new Error('Missing setupEffect');
`
  );
  run(node, ['--loader', './reject-tooling.mjs', 'runtime.mjs']);
  run('npm', [
    'install',
    '--save-dev',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '@oxlint/plugins@1.76.0',
    'oxlint@1.76.0'
  ]);

  writeFileSync(
    join(consumer, '.oxlintrc.json'),
    JSON.stringify({
      jsPlugins: ['@xstate/effect/oxlint'],
      categories: { correctness: 'off' },
      rules: { 'xstate-effect/no-inline-effect': 'error' }
    })
  );
  for (const [fixture, expectedStatus, expectedCount] of [
    ['inline-effect.ts', 1, 5],
    ['declared-effect.ts', 0, 0]
  ]) {
    const source = readFileSync(
      join(root, 'packages/xstate-effect/test/lint-fixtures', fixture),
      'utf8'
    ).replaceAll('../../src/index.ts', '@xstate/effect');
    writeFileSync(join(consumer, fixture), source);
    const result = spawnSync(
      node,
      ['node_modules/oxlint/bin/oxlint', '--format', 'json', fixture],
      { cwd: consumer, encoding: 'utf8' }
    );
    if (result.error) throw result.error;
    assert.equal(result.status, expectedStatus, result.stdout + result.stderr);
    const { diagnostics } = JSON.parse(result.stdout);
    assert.equal(
      diagnostics.length,
      expectedCount,
      JSON.stringify(diagnostics)
    );
    assert.ok(
      diagnostics.every(
        ({ code }) => code === 'xstate-effect(no-inline-effect)'
      ),
      'Expected only the packaged Effect rule'
    );
  }

  writeFileSync(
    join(consumer, 'plugin.ts'),
    `import plugin from '@xstate/effect/oxlint';
export const effectRule = plugin.rules['no-inline-effect'];
`
  );
  writeFileSync(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({ compilerOptions, files: ['plugin.ts'] })
  );
  run(node, ['node_modules/typescript/bin/tsc6', '--pretty', 'false']);

  console.log(
    `Dependency-free Effect core and opt-in plugin passed with ${run(node, ['--version']).trim()} and Oxlint 1.76.0.`
  );
} finally {
  if (process.env.EFFECT_OXLINT_KEEP) {
    console.log(`Kept consumer at ${consumer}`);
  } else {
    rmSync(consumer, { recursive: true, force: true });
  }
}
