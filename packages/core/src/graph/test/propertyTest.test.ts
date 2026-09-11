import { createAsyncLogic, createMachine, types } from '../../index.ts';
import {
  PropertyTestFailure,
  createTestModel,
  formatPropertyTrace,
  propertyTest,
  serializePropertyTrace,
  type PropertyScenarioRunner,
  type PropertyTestAdapter,
  type PropertyTestAdapterResult
} from '../index.ts';
import {
  constant,
  integer,
  randomAdapter,
  record,
  type RandomGeneratorKind
} from './propertyTestAdapter.ts';

const counterMachine = createMachine({
  id: 'counter',
  schemas: {
    context: types<{ count: number }>(),
    events: {
      INC: types<{ value: number }>(),
      RESET: types<{}>()
    }
  },
  context: { count: 0 },
  on: {
    INC: ({ context, event }) => ({
      context: { count: context.count + event.value }
    }),
    RESET: () => ({ context: { count: 0 } })
  }
});

const noop = () => {};

async function captureFailure(
  run: () => Promise<unknown>
): Promise<PropertyTestFailure> {
  try {
    await run();
  } catch (error) {
    return error as PropertyTestFailure;
  }
  throw new Error('Expected the property test to fail');
}

describe('propertyTest with the in-repo random adapter', () => {
  it('checks the invariant on every macrostep of a passing run', async () => {
    const checked: number[] = [];

    const { coverage } = await propertyTest(counterMachine, {
      adapter: randomAdapter({ seed: 7, numRuns: 5, maxCommands: 3 }),
      events: {
        INC: record({ value: integer(0, 2) }),
        RESET: constant({})
      },
      invariant: ({ snapshot }) => {
        checked.push(snapshot.context.count);
      }
    });

    expect(coverage.runs).toBe(5);
    expect(checked.length).toBeGreaterThanOrEqual(5);
    expect(coverage.invariantChecks).toBe(checked.length);
    expect(coverage.statuses.counts.active).toBeGreaterThan(0);
    expect(coverage.exploration.configuredRuns).toBe(5);
    expect(coverage.exploration.maximumSequenceLength).toBe(3);
  });

  it('accepts a TestModel as the source', async () => {
    const { coverage } = await propertyTest(createTestModel(counterMachine), {
      adapter: randomAdapter({ seed: 3, numRuns: 2, maxCommands: 2 }),
      events: { INC: constant({ value: 1 }) },
      invariant: noop
    });

    expect(coverage.runs).toBe(2);
  });

  it('reports a PropertyTestFailure with trace, fixture, coverage and replay', async () => {
    const failure = await captureFailure(() =>
      propertyTest(counterMachine, {
        adapter: randomAdapter({ seed: 1, numRuns: 10, maxCommands: 5 }),
        events: { INC: constant({ value: 5 }) },
        invariant: ({ snapshot }) => {
          expect(snapshot.context.count).toBeLessThan(5);
        }
      })
    );

    expect(failure).toBeInstanceOf(PropertyTestFailure);
    expect(failure.trace.steps.length).toBeGreaterThan(0);
    expect(failure.trace.events).toEqual([{ type: 'INC', value: 5 }]);
    expect(failure.fixture).toMatchObject({
      formatVersion: 2,
      machine: { id: 'counter' },
      failedAt: 1
    });
    expect(failure.replay).toMatchObject({ engine: 'random' });
    expect(failure.coverage?.runs).toBeGreaterThan(0);
    expect(failure.cause).toBeInstanceOf(Error);
  });

  it('keeps the failure message stable after the stack is captured', async () => {
    const failure = await captureFailure(() =>
      propertyTest(counterMachine, {
        adapter: randomAdapter({ seed: 1, numRuns: 5, maxCommands: 2 }),
        events: { INC: constant({ value: 5 }) },
        invariant: ({ snapshot }) => {
          expect(snapshot.context.count).toBeLessThan(5);
        }
      })
    );

    // Regression for GH #3435: the message must be final at construction time,
    // so the captured stack always starts with it.
    expect(failure.message).toBe('Property invariant failed after 1 step');
    expect(
      failure.stack?.startsWith(`PropertyTestFailure: ${failure.message}`)
    ).toBe(true);
  });

  it('does not execute effects returned by transitions', async () => {
    let executed = 0;
    const machine = createMachine({
      on: {
        GO: (_, enq) => enq(() => executed++)
      }
    });
    const effectCounts: number[] = [];

    await propertyTest(machine, {
      adapter: randomAdapter({ seed: 2, numRuns: 3, maxCommands: 4 }),
      events: { GO: constant({}) },
      invariant: ({ effects }) => {
        effectCounts.push(effects.length);
      }
    });

    expect(executed).toBe(0);
    expect(Math.max(...effectCounts)).toBeGreaterThan(0);
  });

  it('collects invoked actor effects without running them', async () => {
    let ran = 0;
    const machine = createMachine({
      id: 'inv',
      initial: 'loading',
      states: {
        loading: {
          invoke: {
            src: createAsyncLogic({
              run: async () => {
                ran++;
                return 1;
              }
            }),
            onDone: { target: 'success' },
            onError: { target: 'failure' }
          },
          on: { PING: { target: 'loading' } }
        },
        success: {},
        failure: {}
      }
    });

    const { coverage } = await propertyTest(machine, {
      adapter: randomAdapter({ seed: 5, numRuns: 3, maxCommands: 3 }),
      events: { PING: constant({}) },
      invariant: noop
    });

    expect(ran).toBe(0);
    expect(coverage.stateNodes.unreachable).toEqual([]);
    expect(coverage.stateNodes.uncovered).toEqual(
      expect.arrayContaining(['inv.success', 'inv.failure'])
    );
  });

  it('covers history state default targets', async () => {
    const machine = createMachine({
      id: 'hist',
      initial: 'outside',
      states: {
        outside: { on: { ENTER: { target: 'group' } } },
        group: {
          initial: 'entry',
          states: {
            entry: { on: { LEAVE: { target: '#hist.outside' } } },
            restored: {},
            recall: { type: 'history', target: 'restored' }
          }
        }
      },
      on: { RESUME: { target: '.group.recall' } }
    });

    const { coverage } = await propertyTest(machine, {
      adapter: randomAdapter({ seed: 11, numRuns: 20, maxCommands: 6 }),
      events: {
        ENTER: constant({}),
        LEAVE: constant({}),
        RESUME: constant({})
      },
      invariant: noop
    });

    expect(coverage.stateNodes.unreachable).toEqual([]);
    expect(coverage.stateNodes.covered).toContain('hist.group.restored');
  });

  it('reaches compound onDone targets', async () => {
    const machine = createMachine({
      id: 'done',
      initial: 'work',
      states: {
        work: {
          initial: 'step',
          states: {
            step: { on: { FINISH: { target: 'complete' } } },
            complete: { type: 'final' }
          },
          onDone: { target: 'wrapUp' }
        },
        wrapUp: {}
      }
    });

    const { coverage } = await propertyTest(machine, {
      adapter: randomAdapter({ seed: 9, numRuns: 10, maxCommands: 4 }),
      events: { FINISH: constant({}) },
      invariant: noop
    });

    expect(coverage.stateNodes.covered).toContain('done.wrapUp');
  });

  it('drives wildcard event descriptors (GH #3229)', async () => {
    const seen: string[] = [];
    const machine = createMachine({
      id: 'wildcard',
      initial: 'idle',
      states: {
        idle: {
          on: { '*': { target: 'touched' } }
        },
        touched: {}
      }
    });

    await propertyTest(machine, {
      adapter: randomAdapter({ seed: 4, numRuns: 3, maxCommands: 2 }),
      events: { WHATEVER: constant({}) },
      invariant: ({ snapshot }) => {
        seen.push(JSON.stringify(snapshot.value));
      }
    });

    expect(seen).toContain('"touched"');
  });

  it('runs a machine with no events using only the checkpoint command (GH #2495)', async () => {
    const machine = createMachine({ id: 'inert' });

    const { coverage } = await propertyTest(machine, {
      adapter: randomAdapter({ seed: 6, numRuns: 3, maxCommands: 3 }),
      events: {},
      commands: { checkpoint: constant({}) },
      invariant: noop
    });

    expect(coverage.runs).toBe(3);
    expect(coverage.checkpoints).toBeGreaterThan(0);
  });

  it('rejects a configuration with no event or command generators', async () => {
    await expect(
      propertyTest(createMachine({ id: 'empty' }), {
        adapter: randomAdapter({ seed: 0, numRuns: 1 }),
        events: {},
        invariant: noop
      })
    ).rejects.toThrow(
      'Property tests require at least one event or command generator'
    );
  });

  it('rejects a non-positive runsPerFrontier', async () => {
    const machine = createMachine({
      id: 'gate',
      initial: 'idle',
      states: {
        idle: { on: { GO: { target: 'active' } } },
        active: { on: { GO: { target: 'idle' } } }
      }
    });
    const model = createTestModel(machine, { events: [{ type: 'GO' }] });
    const frontier = model.getPathsFromEvents([{ type: 'GO' }])[0];
    expect(frontier).toBeDefined();

    await expect(
      propertyTest(model, {
        adapter: randomAdapter({ seed: 0, numRuns: 1 }),
        frontiers: { paths: [frontier], runsPerFrontier: 0 },
        events: { GO: constant({}) },
        invariant: noop
      })
    ).rejects.toThrow('runsPerFrontier must return a positive integer');
  });

  it('exposes the non-generated `canRun` overload on the scenario runner', async () => {
    const decisions: boolean[] = [];
    const adapter: PropertyTestAdapter<RandomGeneratorKind> = {
      async run(request): Promise<PropertyTestAdapterResult> {
        const runner = request.createRunner() as PropertyScenarioRunner<
          any,
          any
        >;
        const { caseId } = request.events[0];
        await runner.start();
        decisions.push(runner.canRun({ type: 'INC', value: 1 }, caseId));
        await runner.run({ type: 'INC', value: 1 }, caseId);
        await runner.stop();
        // The actor is stopped, so no further event is applicable.
        decisions.push(runner.canRun({ type: 'INC', value: 1 }, caseId));
        await runner.dispose();
        return {
          runs: 1,
          exploration: { configuredRuns: 1, maximumSequenceLength: 1 }
        };
      }
    };

    const { coverage } = await propertyTest(counterMachine, {
      adapter,
      events: { INC: constant({ value: 1 }) },
      invariant: noop
    });

    expect(decisions).toEqual([true, false]);
    expect(coverage.stops).toBe(1);
  });
});

describe('property trace serialization', () => {
  async function getFailureTrace() {
    const failure = await captureFailure(() =>
      propertyTest(counterMachine, {
        adapter: randomAdapter({ seed: 1, numRuns: 5, maxCommands: 1 }),
        events: { INC: constant({ value: 5 }) },
        invariant: ({ snapshot }) => {
          expect(snapshot.context.count).toBeLessThan(5);
        }
      })
    );
    return failure;
  }

  it('serializes a trace to JSON-safe data', async () => {
    const failure = await getFailureTrace();
    const serialized = serializePropertyTrace(failure.trace) as any;

    expect(() => JSON.stringify(serialized)).not.toThrow();
    expect(JSON.parse(JSON.stringify(serialized))).toEqual(serialized);
    // Snapshots are serialized through `toJSON`.
    expect(serialized.initialSnapshot).toEqual(
      (
        failure.trace.initialSnapshot as unknown as { toJSON(): unknown }
      ).toJSON()
    );
    expect(serialized.finalSnapshot.context).toEqual({ count: 5 });
    expect(serialized.timeline[0]).toMatchObject({
      kind: 'event',
      index: 0,
      command: {
        type: 'event',
        event: { type: 'INC', value: 5 },
        phase: 'generated',
        origin: 'generator'
      }
    });
  });

  it('formats a trace for humans', async () => {
    const failure = await getFailureTrace();
    const formatted = formatPropertyTrace(failure.trace);

    expect(formatted).toContain('"INC"');
    expect(formatted).toMatch(/^start /);
    expect(formatted.split('\n')[1]).toMatch(/^0\. generated\/generator /);
    expect(`${failure.message}\n${formatted}`).toContain(
      'Property invariant failed after 1 step'
    );
    expect(`${failure.message}\n${formatted}`).toMatchInlineSnapshot(`
      "Property invariant failed after 1 step
      start {"status":"active","context":{"count":0},"value":{},"children":{},"timers":{},"historyValue":{},"_nextTimerId":0,"tags":[]}
      0. generated/generator {"value":5,"type":"INC"} -> {"status":"active","context":{"count":5},"value":{},"children":{},"timers":{},"historyValue":{},"_nextTimerId":0,"tags":[]}
         transitions ["transition","counter","INC",0]"
    `);
  });
});
