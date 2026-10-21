#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeHeapSnapshot } from 'node:v8';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const scenarioName = process.env.XSTATE_MEMORY_SCENARIO;
const count = Number(process.env.XSTATE_MEMORY_COUNT ?? 5_000);
const sampleCount = Number(process.env.XSTATE_MEMORY_SAMPLES ?? 5);

if (!scenarioName) {
  const scenarios = [
    'idle actor',
    'two independent actors',
    'parent-child family',
    'observed actor',
    'inspection actor',
    'timer actor',
    'registry actor',
    'invoked child',
    'observed invoked child',
    'active mailbox actor',
    'pure context planning',
    'flat machine actor',
    'compound machine actor',
    'parallel machine actor'
  ];
  const results = scenarios.map((scenario) => {
    const samples = [];
    for (let index = 0; index < sampleCount; index++) {
      const result = spawnSync(
        process.execPath,
        ['--expose-gc', fileURLToPath(import.meta.url)],
        {
          cwd: root,
          encoding: 'utf8',
          env: {
            ...process.env,
            XSTATE_MEMORY_SCENARIO: scenario,
            XSTATE_MEMORY_COUNT: String(count)
          }
        }
      );
      if (result.status !== 0) {
        process.stderr.write(result.stderr);
        process.exit(result.status ?? 1);
      }
      samples.push(Number(result.stdout));
    }
    samples.sort((a, b) => a - b);
    return {
      scenario,
      bytesPerInstance: samples[Math.floor(samples.length / 2)],
      samples
    };
  });

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ count, sampleCount, results }, null, 2));
  } else {
    console.log(`Retained heap (${count.toLocaleString()} instances)`);
    for (const result of results) {
      console.log(
        `${result.scenario.padEnd(24)} ${result.bytesPerInstance
          .toLocaleString()
          .padStart(8)} bytes/instance  [${result.samples.join(', ')}]`
      );
    }
  }
  process.exit(0);
}

if (typeof global.gc !== 'function') {
  throw new Error('The memory benchmark child requires --expose-gc.');
}

const require = createRequire(import.meta.url);
const { createActor, createMachine, initialTransition, transition } = require(
  process.env.XSTATE_BUNDLE ??
    join(root, 'packages/core/dist/xstate.development.cjs.js')
);
const noop = () => {};
const idleMachine = createMachine({});
const invokedMachine = createMachine({
  invoke: { id: 'child', src: idleMachine }
});
const spawnedMachine = createMachine({
  entry: (_, enq) => enq.spawn(idleMachine, { id: 'child' })
});
const activeMailboxMachine = createMachine({ on: { PING: {} } });
const pureContextMachine = createMachine({
  context: { count: 0 },
  on: {
    INCREMENT: ({ context }) => ({
      context: { count: context.count + 1 }
    })
  }
});
const flatMachine = createMachine({
  initial: 'one',
  states: { one: {}, two: {}, three: {} }
});
const compoundMachine = createMachine({
  initial: 'outer',
  states: {
    outer: {
      initial: 'inner',
      states: { inner: {}, other: {} }
    }
  }
});
const parallelMachine = createMachine({
  type: 'parallel',
  states: {
    left: { initial: 'one', states: { one: {}, two: {} } },
    right: { initial: 'one', states: { one: {}, two: {} } }
  }
});

function createMemoryClock() {
  let nextId = 0;
  const callbacks = new Map();
  return {
    setTimeout(fn) {
      const id = nextId++;
      callbacks.set(id, fn);
      return id;
    },
    clearTimeout(id) {
      callbacks.delete(id);
    }
  };
}

const timerMachine = createMachine({
  initial: 'waiting',
  states: {
    waiting: { after: { 60_000: { target: 'done' } } },
    done: {}
  }
});

const factories = {
  'idle actor': () => createActor(idleMachine).start(),
  'two independent actors': () => [
    createActor(idleMachine).start(),
    createActor(idleMachine).start()
  ],
  'parent-child family': () => createActor(spawnedMachine).start(),
  'observed actor': () => {
    const actor = createActor(idleMachine).start();
    actor.subscribe(noop);
    return actor;
  },
  'inspection actor': () => createActor(idleMachine, { inspect: noop }).start(),
  'timer actor': () =>
    createActor(timerMachine, { clock: createMemoryClock() }).start(),
  'registry actor': () =>
    createActor(idleMachine, { registryKey: 'root' }).start(),
  'invoked child': () => createActor(invokedMachine).start(),
  'observed invoked child': () => {
    const actor = createActor(invokedMachine).start();
    actor.getSnapshot().children.child?.subscribe(noop);
    return actor;
  },
  'active mailbox actor': () => {
    const actor = createActor(activeMailboxMachine).start();
    for (let index = 0; index < 10; index++) {
      actor.send({ type: 'PING' });
    }
    return actor;
  },
  'pure context planning': () => {
    let [snapshot] = initialTransition(pureContextMachine);
    for (let index = 0; index < 10; index++) {
      [snapshot] = transition(pureContextMachine, snapshot, {
        type: 'INCREMENT'
      });
    }
    return snapshot;
  },
  'flat machine actor': () => createActor(flatMachine).start(),
  'compound machine actor': () => createActor(compoundMachine).start(),
  'parallel machine actor': () => createActor(parallelMachine).start()
};

const factory = factories[scenarioName];
if (!factory) {
  throw new Error(`Unknown scenario: ${scenarioName}`);
}

for (let index = 0; index < 200; index++) {
  factory();
}
global.gc();
global.gc();
const before = process.memoryUsage().heapUsed;
const instances = new Array(count);
for (let index = 0; index < count; index++) {
  instances[index] = factory();
}
global.gc();
global.gc();
const after = process.memoryUsage().heapUsed;
if (process.env.XSTATE_MEMORY_HEAP_SNAPSHOT) {
  writeHeapSnapshot(process.env.XSTATE_MEMORY_HEAP_SNAPSHOT);
}
process.stdout.write(String(Math.round((after - before) / count)));
