#!/usr/bin/env node

import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { createActor, createFSM, createMachine } = require(
  join(root, 'packages/core/dist/xstate.development.cjs.js')
);

const args = process.argv.slice(2);
const timeArg = args.find((arg) => arg.startsWith('--time='));
const warmupArg = args.find((arg) => arg.startsWith('--warmup='));
const dunkyArg = args.find((arg) => arg.startsWith('--dunky='));
const json = args.includes('--json');
const measureMemory = args.includes('--memory');

const measureMs = timeArg ? Number(timeArg.slice('--time='.length)) : 500;
const warmupMs = warmupArg ? Number(warmupArg.slice('--warmup='.length)) : 100;
const batchSize = 1_000;
const dunkySpecifier = dunkyArg?.slice('--dunky='.length);

if (!Number.isFinite(measureMs) || measureMs <= 0) {
  throw new Error('--time must be a positive number of milliseconds');
}

if (!Number.isFinite(warmupMs) || warmupMs < 0) {
  throw new Error('--warmup must be a non-negative number of milliseconds');
}

const noop = () => {};

async function importOptional(specifier) {
  if (!specifier) {
    return undefined;
  }
  try {
    if (
      specifier.startsWith('.') ||
      specifier.startsWith('/') ||
      specifier.startsWith('..')
    ) {
      return await import(pathToFileURL(specifier).href);
    }
    return await import(specifier);
  } catch (err) {
    throw new Error(
      `Unable to import Dunky package from "${specifier}". Build it first or pass a built entry file, e.g. --dunky=/tmp/dunky-state-machine/packages/core/dist/index.js\n${err.message}`
    );
  }
}

function runFor(ms, fn) {
  const start = performance.now();
  let count = 0;
  while (performance.now() - start < ms) {
    for (let i = 0; i < batchSize; i++) {
      fn();
    }
    count += batchSize;
  }
  return [performance.now() - start, count];
}

function bench(name, fn) {
  runFor(warmupMs, fn);
  const [elapsedMs, count] = runFor(measureMs, fn);
  return {
    name,
    opsPerSecond: Math.round(count / (elapsedMs / 1000)),
    elapsedMs: Math.round(elapsedMs),
    count
  };
}

function makeFSMTarget() {
  return createFSM({
    initial: 'a',
    states: {
      a: { on: { next: { target: 'b' } } },
      b: { on: { next: { target: 'a' } } }
    }
  });
}

function makeMachineTarget() {
  return createMachine({
    initial: 'a',
    states: {
      a: { on: { next: { target: 'b' } } },
      b: { on: { next: { target: 'a' } } }
    }
  });
}

function makeFSMContext() {
  return createFSM({
    initial: 'idle',
    context: { value: 0 },
    states: {
      idle: {
        on: {
          hit: { context: { value: 1 } }
        }
      }
    }
  });
}

function makeMachineContext() {
  return createMachine({
    initial: 'idle',
    context: { value: 0 },
    states: {
      idle: {
        on: {
          hit: { context: { value: 1 } }
        }
      }
    }
  });
}

function makeFSMFunctionContext() {
  return createFSM({
    initial: 'idle',
    context: { value: 0 },
    states: {
      idle: {
        on: {
          hit: ({ context }) => ({ context: { value: context.value + 1 } })
        }
      }
    }
  });
}

function makeMachineFunctionContext() {
  return createMachine({
    initial: 'idle',
    context: { value: 0 },
    states: {
      idle: {
        on: {
          hit: {
            to: ({ context }) => ({ context: { value: context.value + 1 } })
          }
        }
      }
    }
  });
}

function makeFSMEnq() {
  return createFSM({
    initial: 'idle',
    states: {
      idle: {
        on: {
          hit: (_, enq) => {
            enq(noop);
          }
        }
      }
    }
  });
}

function makeMachineEnq() {
  return createMachine({
    initial: 'idle',
    states: {
      idle: {
        on: {
          hit: {
            to: (_, enq) => {
              enq(noop);
            }
          }
        }
      }
    }
  });
}

function makeDunkyTarget(machine) {
  return machine({
    initial: 'a',
    states: {
      a: { on: { next: { target: 'b' } } },
      b: { on: { next: { target: 'a' } } }
    }
  });
}

function makeDunkyStaticContext(machine, act) {
  return machine({
    initial: 'idle',
    context: { value: 0 },
    states: {
      idle: {
        on: {
          hit: { actions: [act({ value: 1 })] }
        }
      }
    }
  });
}

function makeDunkyFunctionContext(machine, act) {
  return machine({
    initial: 'idle',
    context: { value: 0 },
    states: {
      idle: {
        on: {
          hit: {
            actions: [act(({ context }) => ({ value: context.value + 1 }))]
          }
        }
      }
    }
  });
}

function makeDunkyFunctionAction(machine) {
  return machine({
    initial: 'idle',
    states: {
      idle: {
        on: {
          hit: { actions: [noop] }
        }
      }
    }
  });
}

function makeDunkySendBench(makeLogic, event) {
  const logic = makeLogic();
  logic.start();
  return () => {
    logic.send(event);
  };
}

function makeRawTransitionBench(makeLogic, event) {
  const logic = makeLogic();
  const actor = createActor(logic).start();
  const actorScope = actor._actorScope;
  let snapshot = logic.getInitialSnapshot(actorScope, undefined);
  return () => {
    [snapshot] = logic.transition(snapshot, event, actorScope);
  };
}

function makeActorSendBench(makeLogic, event) {
  const actor = createActor(makeLogic()).start();
  return () => {
    actor.send(event);
  };
}

function benchConstruction(name, makeLogic) {
  return bench(name, makeLogic);
}

function memoryPerInstance(name, makeLogic, count = 10_000) {
  if (typeof global.gc !== 'function') {
    return {
      name,
      skipped:
        'run with: node --expose-gc scripts/bench-core-runtime.mjs --memory'
    };
  }

  global.gc();
  const before = process.memoryUsage().heapUsed;
  const instances = new Array(count);
  for (let i = 0; i < count; i++) {
    instances[i] = makeLogic();
  }
  global.gc();
  const after = process.memoryUsage().heapUsed;
  instances.length = 0;
  global.gc();

  return {
    name,
    bytesPerInstance: Math.round((after - before) / count),
    count
  };
}

const dunkyModule = await importOptional(dunkySpecifier);
const dunkyResults = [];

if (dunkyModule) {
  const { machine, act } = dunkyModule;
  if (typeof machine !== 'function' || typeof act !== 'function') {
    throw new Error(
      `Dunky package must export machine() and act(); got machine=${typeof machine}, act=${typeof act}`
    );
  }
  dunkyResults.push(
    bench(
      'Dunky send: { target }',
      makeDunkySendBench(() => makeDunkyTarget(machine), { type: 'next' })
    ),
    bench(
      'Dunky send: static context action',
      makeDunkySendBench(() => makeDunkyStaticContext(machine, act), {
        type: 'hit'
      })
    ),
    bench(
      'Dunky send: function context action',
      makeDunkySendBench(() => makeDunkyFunctionContext(machine, act), {
        type: 'hit'
      })
    ),
    bench(
      'Dunky send: function action',
      makeDunkySendBench(() => makeDunkyFunctionAction(machine), {
        type: 'hit'
      })
    ),
    benchConstruction('construct Dunky', () => makeDunkyTarget(machine))
  );
}

const results = [
  bench(
    'createFSM raw transition: { target }',
    makeRawTransitionBench(makeFSMTarget, { type: 'next' })
  ),
  bench(
    'createMachine raw transition: { target }',
    makeRawTransitionBench(makeMachineTarget, { type: 'next' })
  ),
  bench(
    'createFSM actor.send: { target }',
    makeActorSendBench(makeFSMTarget, { type: 'next' })
  ),
  bench(
    'createMachine actor.send: { target }',
    makeActorSendBench(makeMachineTarget, { type: 'next' })
  ),
  bench(
    'createFSM actor.send: { context }',
    makeActorSendBench(makeFSMContext, { type: 'hit' })
  ),
  bench(
    'createMachine actor.send: { context }',
    makeActorSendBench(makeMachineContext, { type: 'hit' })
  ),
  bench(
    'createFSM actor.send: function context',
    makeActorSendBench(makeFSMFunctionContext, { type: 'hit' })
  ),
  bench(
    'createMachine actor.send: function context',
    makeActorSendBench(makeMachineFunctionContext, { type: 'hit' })
  ),
  bench(
    'createFSM actor.send: function enq',
    makeActorSendBench(makeFSMEnq, { type: 'hit' })
  ),
  bench(
    'createMachine actor.send: function enq',
    makeActorSendBench(makeMachineEnq, { type: 'hit' })
  ),
  benchConstruction('construct createFSM', makeFSMTarget),
  benchConstruction('construct createMachine', makeMachineTarget),
  ...dunkyResults
];

const memoryResults = measureMemory
  ? [
      memoryPerInstance('memory createFSM', makeFSMTarget),
      memoryPerInstance('memory createMachine', makeMachineTarget)
    ]
  : [];

if (json) {
  console.log(
    JSON.stringify(
      {
        measureMs,
        warmupMs,
        results,
        memory: memoryResults
      },
      null,
      2
    )
  );
} else {
  console.log(`Runtime benchmark (${measureMs}ms each, ${warmupMs}ms warmup)`);
  console.log('');
  for (const result of results) {
    console.log(
      `${result.name.padEnd(48)} ${result.opsPerSecond.toLocaleString()} ops/s`
    );
  }
  if (memoryResults.length) {
    console.log('');
    for (const result of memoryResults) {
      if ('skipped' in result) {
        console.log(`${result.name.padEnd(48)} ${result.skipped}`);
      } else {
        console.log(
          `${result.name.padEnd(48)} ${result.bytesPerInstance.toLocaleString()} bytes/instance`
        );
      }
    }
  }
}
