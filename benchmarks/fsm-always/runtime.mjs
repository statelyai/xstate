import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../..');
const buildDirectory = path.join(directory, '.runtime');
const profiles = (
  process.env.CASES ?? 'toggle,counter,ignored,construction'
).split(',');
const variants = ['base', 'feature'];
const rounds = Number(process.env.ROUNDS ?? 9);
const sampleMs = Number(process.env.SAMPLE_MS ?? 400);
const [profile, selectedVariant, mode] = process.argv.slice(2);
const config = {
  initial: 'off',
  states: {
    off: { on: { TOGGLE: { target: 'on' } } },
    on: { on: { TOGGLE: { target: 'off' } } }
  }
};

function fixture(createFSM, name) {
  const machine = createFSM(
    name === 'counter'
      ? {
          initial: 'off',
          context: { count: 0 },
          states: {
            off: {
              on: {
                INC: ({ context }) => ({
                  context: { count: context.count + 1 }
                })
              }
            }
          }
        }
      : config
  );
  const event = {
    type: name === 'counter' ? 'INC' : name === 'ignored' ? 'UNKNOWN' : 'TOGGLE'
  };
  let state = machine.initialState;
  let last;
  return name === 'construction'
    ? {
        run() {
          last = createFSM(config);
        },
        verify(count) {
          assert(count > 0);
          assert.equal(last.initialState.value, 'off');
          assert.equal(last.config, config);
          assert.equal(typeof last.transition, 'function');
        }
      }
    : {
        run() {
          [state] = machine.transition(state, event);
        },
        verify(count) {
          assert.equal(
            state.value,
            name === 'toggle' && count % 2 ? 'on' : 'off'
          );
          if (name === 'counter') assert.equal(state.context.count, count);
          if (name === 'ignored') assert.equal(state, machine.initialState);
        }
      };
}

function run(subject, duration, minimumCpuMs = 0) {
  const start = performance.now();
  const cpuStart = process.cpuUsage();
  let iterations = 0;
  let elapsed;
  let cpu;
  do {
    for (let i = 0; i < 16384; i++) subject.run();
    iterations += 16384;
    elapsed = performance.now() - start;
    if (elapsed >= duration) cpu = process.cpuUsage(cpuStart);
  } while (
    (elapsed < duration || (cpu.user + cpu.system) / 1000 < minimumCpuMs) &&
    elapsed < 5000
  );
  cpu = process.cpuUsage(cpuStart);
  const cpuMs = (cpu.user + cpu.system) / 1000;
  return {
    iterations,
    wallMs: elapsed,
    cpuMs,
    wallNsPerOperation: (elapsed * 1e6) / iterations,
    cpuNsPerOperation: (cpuMs * 1e6) / iterations
  };
}

if (!profile) {
  const require = createRequire(path.join(root, 'package.json'));
  const viteRequire = createRequire(require.resolve('vitest'));
  const esbuild = createRequire(viteRequire.resolve('vite'))('esbuild');
  mkdirSync(buildDirectory, { recursive: true });
  const base = execFileSync(
    'git',
    [
      'show',
      'da64b0aa177a40501f488612296f527a4f8b46ab:packages/core/src/fsm.ts'
    ],
    { cwd: root, encoding: 'utf8' }
  );
  const feature = readFileSync(
    path.join(root, 'packages/core/src/fsm.ts'),
    'utf8'
  );
  for (const [name, contents] of Object.entries({ base, feature })) {
    await esbuild.build({
      stdin: {
        contents,
        loader: 'ts',
        resolveDir: path.join(root, 'packages/core/src')
      },
      bundle: true,
      minify: true,
      format: 'esm',
      platform: 'neutral',
      target: 'es2022',
      outfile: path.join(buildDirectory, `${name}.mjs`)
    });
    await esbuild.build({
      stdin: {
        contents,
        loader: 'ts',
        resolveDir: path.join(root, 'packages/core/src')
      },
      bundle: true,
      minify: false,
      format: 'esm',
      platform: 'neutral',
      target: 'es2022',
      outfile: path.join(buildDirectory, `${name}-profile.mjs`)
    });
  }
  const results = {
    baseline: 'da64b0aa177a40501f488612296f527a4f8b46ab',
    featureSha256: createHash('sha256').update(feature).digest('hex'),
    environment: {
      runtime: process.versions,
      cpu: os.cpus()[0].model,
      cores: os.cpus().length,
      os: `${os.type()} ${os.release()} ${os.arch()}`,
      load: os.loadavg()
    },
    rounds,
    sampleMs,
    minimumCpuMs: 150,
    results: []
  };
  for (const name of profiles) {
    const child = spawnSync(
      process.execPath,
      [fileURLToPath(import.meta.url), name],
      { env: process.env, encoding: 'utf8' }
    );
    if (child.status !== 0) throw Error(child.stderr || child.stdout);
    results.results.push(JSON.parse(child.stdout));
    writeFileSync(
      path.join(
        process.env.RESULTS_DIR ?? directory,
        `runtime-${process.versions.bun ? 'bun' : 'node'}.json`
      ),
      JSON.stringify(results, null, 2) + '\n'
    );
    console.error(`Completed ${process.versions.bun ? 'Bun' : 'Node'} ${name}`);
  }
} else {
  assert(profiles.includes(profile));
  if (mode === 'profile') {
    assert(variants.includes(selectedVariant));
    const { createFSM } = await import(
      pathToFileURL(path.join(buildDirectory, `${selectedVariant}-profile.mjs`))
    );
    const subject = fixture(createFSM, profile);
    const warm = run(subject, 500);
    const sample = run(subject, 3000);
    subject.verify(warm.iterations + sample.iterations);
    console.log(
      JSON.stringify({ profile, variant: selectedVariant, ...sample })
    );
  } else {
    const modules = Object.fromEntries(
      await Promise.all(
        variants.map(async (name) => [
          name,
          await import(pathToFileURL(path.join(buildDirectory, `${name}.mjs`)))
        ])
      )
    );
    // Establish the intended work before collecting any performance samples.
    for (const name of variants) {
      const subject = fixture(modules[name].createFSM, profile);
      for (let i = 0; i < 101; i++) subject.run();
      subject.verify(101);
      const warm = run(subject, 500);
      subject.verify(101 + warm.iterations);
    }
    const samples = { base: [], feature: [] };
    for (let round = 0; round < rounds; round++) {
      for (const name of round % 2 ? [...variants].reverse() : variants) {
        const subject = fixture(modules[name].createFSM, profile);
        const warm = run(subject, 200);
        const sample = run(subject, sampleMs, 150);
        subject.verify(warm.iterations + sample.iterations);
        samples[name].push(sample);
      }
    }
    console.log(
      JSON.stringify({ profile, load: os.loadavg(), verified: true, samples })
    );
  }
}
