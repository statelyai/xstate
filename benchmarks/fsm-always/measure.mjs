import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzip } from 'pako';
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const require = createRequire(path.join(root, 'package.json'));
const viteRequire = createRequire(require.resolve('vitest'));
const esbuild = createRequire(viteRequire.resolve('vite'))('esbuild');
const { minify } = createRequire(
  require.resolve('@preconstruct/cli/package.json')
)('terser');
const base = execFileSync(
  'git',
  ['show', 'da64b0aa177a40501f488612296f527a4f8b46ab:packages/core/src/fsm.ts'],
  { cwd: root, encoding: 'utf8' }
);
const feature = readFileSync(
  path.join(root, 'packages/core/src/fsm.ts'),
  'utf8'
);
const profiles = {
  library: `export { createFSM, setup } from 'fsm-feature';
    export { types } from './packages/core/src/schema.types.ts';`,
  toggle: `import {createFSM} from 'fsm-feature';
  const m=createFSM({initial:'off',states:{off:{on:{TOGGLE:'on'}},on:{on:{TOGGLE:'off'}}}});
  console.log(m.transition(m.initialState,{type:'TOGGLE'})[0].value);`
};
const report = {
  base: 'da64b0aa177a40501f488612296f527a4f8b46ab',
  node: process.version,
  esbuild: esbuild.version,
  profiles: {}
};
for (const [profile, entry] of Object.entries(profiles)) {
  const measurements = {};
  for (const [variant, source] of Object.entries({ base, feature })) {
    const bundle = await esbuild.build({
      stdin: {
        contents: entry,
        resolveDir: root,
        sourcefile: 'entry.ts',
        loader: 'ts'
      },
      bundle: true,
      write: false,
      minify: false,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      plugins: [
        {
          name: 'fsm-source',
          setup(b) {
            b.onResolve({ filter: /^fsm-feature$/ }, () => ({
              path: 'fsm',
              namespace: 'feature'
            }));
            b.onLoad({ filter: /.*/, namespace: 'feature' }, () => ({
              contents: source,
              loader: 'ts',
              resolveDir: path.join(root, 'packages/core/src')
            }));
          }
        }
      ]
    });
    const code = bundle.outputFiles[0].text;
    const esbuildMin = (
      await esbuild.transform(code, {
        minify: true,
        format: 'esm',
        target: 'es2022'
      })
    ).code;
    const terserMin = (
      await minify(code, {
        module: true,
        compress: { passes: 3 },
        mangle: true
      })
    ).code;
    measurements[variant] = {
      esbuild: {
        minified: Buffer.byteLength(esbuildMin),
        gzip: gzip(esbuildMin, { level: 9 }).length
      },
      terser: {
        minified: Buffer.byteLength(terserMin),
        gzip: gzip(terserMin, { level: 9 }).length
      }
    };
  }
  measurements.delta = Object.fromEntries(
    ['esbuild', 'terser'].map((tool) => [
      tool,
      Object.fromEntries(
        ['minified', 'gzip'].map((metric) => [
          metric,
          measurements.feature[tool][metric] - measurements.base[tool][metric]
        ])
      )
    ])
  );
  report.profiles[profile] = measurements;
}
writeFileSync(
  path.join(root, 'benchmarks/fsm-always/size.json'),
  JSON.stringify(report, null, 2) + '\n'
);
console.log(JSON.stringify(report, null, 2));
