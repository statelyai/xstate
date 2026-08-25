#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const getArg = (name) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const isWorker = args.includes('--worker');
const verify = args.includes('--verify');

const scenarioIterations = {
  'machine-construction': 100_000,
  'actor-construction': 25_000,
  'actor-start': 20_000,
  'event-processing': 500_000,
  'guarded-transition': 250_000,
  'context-update': 250_000,
  'ordered-actions': 100_000,
  'eventless-stabilization': 20_000,
  'subscription-notification': 250_000,
  'final-completion': 20_000,
  'persistence-restoration': 20_000,
  'memory-idle-actor': 1,
  'retained-snapshot-allocation': 1
};

const memoryScenarios = new Set([
  'memory-idle-actor',
  'retained-snapshot-allocation'
]);

let checksum = 0;

function createToggle(createFSM) {
  return createFSM({
    initial: 'inactive',
    states: {
      inactive: { on: { toggle: { target: 'active' } } },
      active: { on: { toggle: { target: 'inactive' } } }
    }
  });
}

function createTask(name, { createActor, createFSM }) {
  switch (name) {
    case 'machine-construction':
      return {
        run() {
          const logic = createToggle(createFSM);
          checksum += logic.id?.length ?? 1;
        }
      };
    case 'actor-construction': {
      const logic = createToggle(createFSM);
      return {
        run() {
          const actor = createActor(logic);
          checksum += actor.getSnapshot().value.length;
        }
      };
    }
    case 'actor-start': {
      const logic = createToggle(createFSM);
      return {
        run() {
          const actor = createActor(logic).start();
          checksum += actor.getSnapshot().value.length;
        }
      };
    }
    case 'event-processing': {
      const actor = createActor(createToggle(createFSM)).start();
      return {
        run() {
          actor.send({ type: 'toggle' });
        },
        verify() {
          checksum += actor.getSnapshot().value.length;
        }
      };
    }
    case 'guarded-transition': {
      const logic = createFSM({
        initial: 'active',
        context: { count: 0 },
        states: {
          active: {
            on: {
              hit: [
                {
                  guard: ({ event }) => event.accept,
                  context: ({ context }) => ({ count: context.count + 1 })
                },
                {}
              ]
            }
          }
        }
      });
      const actor = createActor(logic).start();
      let accept = false;
      return {
        run() {
          accept = !accept;
          actor.send({ type: 'hit', accept });
        },
        verify() {
          checksum += actor.getSnapshot().context.count;
        }
      };
    }
    case 'context-update': {
      const logic = createFSM({
        initial: 'active',
        context: { count: 0 },
        states: {
          active: {
            on: {
              hit: {
                context: ({ context }) => ({ count: context.count + 1 })
              }
            }
          }
        }
      });
      const actor = createActor(logic).start();
      return {
        run() {
          actor.send({ type: 'hit' });
        },
        verify() {
          checksum += actor.getSnapshot().context.count;
        }
      };
    }
    case 'ordered-actions': {
      let calls = 0;
      const effect = () => calls++;
      const logic = createFSM({
        initial: 'left',
        states: {
          left: {
            exit: (_, enq) => enq(effect),
            on: {
              toggle: (_, enq) => {
                enq(effect);
                return { target: 'right' };
              }
            }
          },
          right: {
            entry: (_, enq) => enq(effect),
            exit: (_, enq) => enq(effect),
            on: {
              toggle: (_, enq) => {
                enq(effect);
                return { target: 'left' };
              }
            }
          }
        }
      });
      const actor = createActor(logic).start();
      return {
        run() {
          actor.send({ type: 'toggle' });
        },
        verify() {
          checksum += calls;
        }
      };
    }
    case 'eventless-stabilization': {
      const logic = createFSM({
        initial: 'checking',
        context: { ready: true },
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
      const probe = createActor(logic).start();
      if (probe.getSnapshot().value !== 'ready') {
        return { skipped: 'unsupported by this createFSM build' };
      }
      return {
        run() {
          const actor = createActor(logic).start();
          checksum += actor.getSnapshot().value.length;
        }
      };
    }
    case 'subscription-notification': {
      let notifications = 0;
      const actor = createActor(createToggle(createFSM)).start();
      actor.subscribe(() => notifications++);
      return {
        run() {
          actor.send({ type: 'toggle' });
        },
        verify() {
          checksum += notifications;
        }
      };
    }
    case 'final-completion': {
      const logic = createFSM({
        initial: 'active',
        states: {
          active: { on: { finish: { target: 'done' } } },
          done: { type: 'final' }
        }
      });
      const probe = createActor(logic).start();
      probe.send({ type: 'finish' });
      if (probe.getSnapshot().status !== 'done') {
        return { skipped: 'unsupported by this createFSM build' };
      }
      return {
        run() {
          const actor = createActor(logic).start();
          actor.send({ type: 'finish' });
          checksum += actor.getSnapshot().status.length;
        }
      };
    }
    case 'persistence-restoration': {
      const logic = createToggle(createFSM);
      const actor = createActor(logic).start();
      actor.send({ type: 'toggle' });
      const persisted = actor.getPersistedSnapshot();
      return {
        run() {
          const restored = createActor(logic, { snapshot: persisted }).start();
          checksum += restored.getSnapshot().value.length;
        }
      };
    }
    default:
      throw new Error(`Unknown scenario: ${name}`);
  }
}

function measureMemory(name, api) {
  if (typeof global.gc !== 'function') {
    throw new Error('memory scenarios require --expose-gc');
  }
  if (name === 'memory-idle-actor') {
    const logic = createToggle(api.createFSM);
    const actors = [];
    for (let index = 0; index < 2_000; index++) {
      actors.push(api.createActor(logic).start());
    }
    global.gc();
    global.gc();
    const first = process.memoryUsage().heapUsed;
    for (let index = 0; index < 6_000; index++) {
      actors.push(api.createActor(logic).start());
    }
    global.gc();
    global.gc();
    const second = process.memoryUsage().heapUsed;
    checksum += actors.length;
    return {
      unit: 'bytes/actor',
      value: Math.max(0, (second - first) / 6_000)
    };
  }

  const actor = api.createActor(createToggle(api.createFSM)).start();
  const snapshots = [];
  global.gc();
  global.gc();
  const before = process.memoryUsage().heapUsed;
  for (let index = 0; index < 20_000; index++) {
    actor.send({ type: 'toggle' });
    snapshots.push(actor.getSnapshot());
  }
  global.gc();
  global.gc();
  const after = process.memoryUsage().heapUsed;
  checksum += snapshots.length;
  return {
    unit: 'retained bytes/transition',
    value: Math.max(0, (after - before) / snapshots.length)
  };
}

function runWorker() {
  const modulePath = resolve(getArg('module'));
  const scenario = getArg('scenario');
  const mode = getArg('mode');
  const iterations = Number(getArg('iterations'));
  const loaded = createRequire(import.meta.url)(modulePath);
  const api = {
    ...loaded,
    createActor: loaded.createFSMActor ?? loaded.createActor
  };

  if (memoryScenarios.has(scenario)) {
    return measureMemory(scenario, api);
  }

  const task = createTask(scenario, api);
  if (task.skipped) {
    return { skipped: task.skipped };
  }
  if (mode === 'warm') {
    const warmupIterations = Math.max(100, Math.floor(iterations / 10));
    for (let index = 0; index < warmupIterations; index++) {
      task.run();
    }
  }
  const measuredIterations = mode === 'cold' ? 1 : iterations;
  const batchCount = mode === 'cold' ? 1 : 5;
  const batchIterations = Math.max(
    1,
    Math.floor(measuredIterations / batchCount)
  );
  const timings = [];
  for (let batch = 0; batch < batchCount; batch++) {
    const start = performance.now();
    for (let index = 0; index < batchIterations; index++) {
      task.run();
    }
    timings.push(((performance.now() - start) * 1e6) / batchIterations);
  }
  task.verify?.();
  if (!Number.isFinite(checksum)) {
    throw new Error('invalid benchmark checksum');
  }
  return {
    unit: 'ns/op',
    value: timings.sort((left, right) => left - right)[
      Math.floor(timings.length / 2)
    ]
  };
}

if (isWorker) {
  process.stdout.write(JSON.stringify(runWorker()));
  process.exit(0);
}

const samples = Number(getArg('samples') ?? (verify ? 5 : 10));
const filter = new RegExp(getArg('filter') ?? '.');
const selectedMode = getArg('mode') ?? (verify ? 'warm' : 'all');
const currentModule = resolve(
  getArg('module') ?? join(root, 'packages/core/dist/xstate-fsm.cjs.js')
);
const baseModule = getArg('base')
  ? resolve(getArg('base'))
  : verify
    ? join(root, 'packages/core/dist/xstate.cjs.js')
    : undefined;
const headModule = getArg('head') ? resolve(getArg('head')) : currentModule;
const candidates = baseModule
  ? [
      ['base', baseModule],
      ['head', headModule]
    ]
  : [['current', currentModule]];
const modes =
  selectedMode === 'all' ? ['cold', 'warm', 'memory'] : [selectedMode];
const results = new Map();

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

for (let sample = 0; sample < samples; sample++) {
  for (const [scenario, iterations] of Object.entries(scenarioIterations)) {
    if (!filter.test(scenario)) {
      filter.lastIndex = 0;
      continue;
    }
    filter.lastIndex = 0;
    const mode = memoryScenarios.has(scenario) ? 'memory' : 'warm';
    const requestedModes = mode === 'memory' ? ['memory'] : modes;
    for (const requestedMode of requestedModes) {
      if (requestedMode === 'memory' && mode !== 'memory') continue;
      if (requestedMode !== 'memory' && mode === 'memory') continue;
      const orderedCandidates =
        sample % 2 === 0 ? candidates : [...candidates].reverse();
      for (const [label, modulePath] of orderedCandidates) {
        const output = execFileSync(
          process.execPath,
          [
            '--expose-gc',
            fileURLToPath(import.meta.url),
            '--worker',
            `--module=${modulePath}`,
            `--scenario=${scenario}`,
            `--mode=${requestedMode}`,
            `--iterations=${iterations}`
          ],
          { encoding: 'utf8', maxBuffer: 1024 * 1024 }
        );
        const value = JSON.parse(output);
        const key = `${scenario}:${requestedMode}`;
        const byLabel = results.get(key) ?? new Map();
        const values = byLabel.get(label) ?? [];
        values.push(value);
        byLabel.set(label, values);
        results.set(key, byLabel);
      }
    }
  }
}

const report = {};
for (const [key, byLabel] of results) {
  report[key] = {};
  for (const [label, values] of byLabel) {
    const measured = values.filter((value) => value.value !== undefined);
    if (!measured.length) {
      report[key][label] = { skipped: values[0]?.skipped };
      continue;
    }
    const sampleValues = measured.map((value) => value.value);
    const center = median(sampleValues);
    report[key][label] = {
      unit: measured[0].unit,
      median: center,
      mad: median(sampleValues.map((value) => Math.abs(value - center))),
      samples: sampleValues
    };
  }
  if (report[key].base?.median && report[key].head?.median) {
    const baseSamples = report[key].base.samples;
    const headSamples = report[key].head.samples;
    const pairedChanges = baseSamples.map(
      (base, index) => ((headSamples[index] - base) / base) * 100
    );
    const change = median(pairedChanges);
    report[key].changePercent = change;
    report[key].changeMad = median(
      pairedChanges.map((value) => Math.abs(value - change))
    );
  }
}

if (args.includes('--json')) {
  console.log(JSON.stringify({ samples, report }, null, 2));
} else {
  console.log(`FSM runtime benchmark (${samples} fresh processes per row)`);
  for (const [key, row] of Object.entries(report)) {
    const columns = Object.entries(row)
      .filter(([label]) => label !== 'changePercent' && label !== 'changeMad')
      .map(([label, result]) =>
        result.skipped
          ? `${label}=unsupported`
          : `${label}=${result.median.toFixed(1)} ${result.unit} MAD ${result.mad.toFixed(1)}`
      );
    const change =
      row.changePercent === undefined
        ? ''
        : ` paired change=${row.changePercent >= 0 ? '+' : ''}${row.changePercent.toFixed(1)}% MAD ${row.changeMad.toFixed(1)}%`;
    console.log(`${key.padEnd(40)} ${columns.join('  ')}${change}`);
  }
}

if (verify) {
  const regressions = Object.entries(report).filter(([, row]) => {
    return (
      row.changePercent !== undefined &&
      row.changePercent > 5 &&
      row.changePercent - row.changeMad > 5
    );
  });
  if (regressions.length) {
    throw new Error(
      `FSM runtime regressions beyond 5% and measured noise:\n${regressions
        .map(
          ([key, row]) =>
            `${key}: +${row.changePercent.toFixed(1)}% MAD ${row.changeMad.toFixed(1)}%`
        )
        .join('\n')}`
    );
  }
}
