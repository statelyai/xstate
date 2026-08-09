import * as fc from 'fast-check';
import {
  createMachine,
  initialTransition,
  SimulatedClock,
  types
} from 'xstate';
import {
  PropertyTestFailure,
  createTestModel,
  propertyTest,
  replayPropertyTest
} from 'xstate/graph';
import { fastCheckAdapter } from '../src/index.ts';

const counterMachine = createMachine({
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

describe('propertyTest with FastCheck', () => {
  it('accepts machines and test models and checks every macrostep', async () => {
    for (const source of [counterMachine, createTestModel(counterMachine)]) {
      const checked: number[] = [];
      const result = await propertyTest(source, {
        adapter: fastCheckAdapter({ seed: 42, numRuns: 5, maxCommands: 3 }),
        events: {
          INC: fc.record({ value: fc.integer({ min: 0, max: 2 }) }),
          RESET: fc.constant({})
        },
        invariant: ({ snapshot }) => {
          checked.push(snapshot.context.count);
        }
      });

      expect(result.coverage.runs).toBe(5);
      expect(checked.length).toBeGreaterThanOrEqual(5);
      expect(result.coverage.invariantChecks).toBe(checked.length);
      expect(result.coverage.statuses.counts.active).toBeGreaterThan(0);
    }
  });

  it('shrinks failures and exposes replay metadata', async () => {
    const run = () =>
      propertyTest(counterMachine, {
        adapter: fastCheckAdapter({ seed: 123, numRuns: 20, maxCommands: 10 }),
        events: {
          INC: fc.record({ value: fc.integer({ min: 1, max: 1_000 }) })
        },
        invariant: ({ snapshot }) => {
          expect(snapshot.context.count).toBeLessThan(10);
        }
      });

    const error = await run().catch((value) => value);
    expect(error).toBeInstanceOf(PropertyTestFailure);
    expect(error.trace.steps.length).toBeGreaterThan(0);
    expect(error.replay).toMatchObject({
      engine: 'fast-check',
      seed: expect.any(Number),
      path: expect.any(String)
    });
  });

  it('does not execute returned effects', async () => {
    let executed = 0;
    const machine = createMachine({
      on: {
        GO: (_, enq) => enq(() => executed++)
      }
    });

    await propertyTest(machine, {
      adapter: fastCheckAdapter({ seed: 1, numRuns: 5, maxCommands: 5 }),
      events: { GO: fc.constant({}) },
      invariant: () => {}
    });

    expect(executed).toBe(0);
  });

  it('creates portable fixtures that replay without FastCheck', async () => {
    let error!: PropertyTestFailure;
    try {
      await propertyTest(counterMachine, {
        adapter: fastCheckAdapter({ seed: 123, numRuns: 20, maxCommands: 10 }),
        events: {
          INC: fc.record({ value: fc.integer({ min: 1, max: 1_000 }) })
        },
        invariant: ({ snapshot }) => {
          expect(snapshot.context.count).toBeLessThan(10);
        }
      });
    } catch (value) {
      error = value as PropertyTestFailure;
    }

    expect(error.fixture).toMatchObject({ formatVersion: 2, failedAt: 1 });
    let replayed!: PropertyTestFailure;
    try {
      await replayPropertyTest(counterMachine, error.fixture!, {
        invariant: ({ snapshot }) => {
          expect(snapshot.context.count).toBeLessThan(10);
        }
      });
    } catch (value) {
      replayed = value as PropertyTestFailure;
    }
    expect(replayed).toBeInstanceOf(PropertyTestFailure);
    expect(replayed.trace.steps).toHaveLength(error.trace.steps.length);
  });

  it('starts from an explicitly serializable snapshot', async () => {
    const [snapshot] = initialTransition(counterMachine);
    const seen: number[] = [];

    await propertyTest(counterMachine, {
      adapter: fastCheckAdapter({ seed: 4, numRuns: 2, maxCommands: 1 }),
      start: {
        snapshot,
        serializeSnapshot: (value) => value.toJSON()
      },
      events: { INC: fc.constant({ value: 1 }) },
      invariant: ({ snapshot: value }) => {
        seen.push(value.context.count);
      }
    });

    expect(seen).toContain(0);
  });

  it('generates shrinkable continuations from graph frontiers', async () => {
    const machine = createMachine({
      schemas: {
        context: types<{ count: number }>(),
        events: {
          GO: types<{}>(),
          INC: types<{ value: number }>()
        }
      },
      context: { count: 0 },
      initial: 'idle',
      states: {
        idle: { on: { GO: { target: 'active' } } },
        active: {
          on: {
            INC: ({ context, event }) => ({
              context: { count: context.count + event.value }
            })
          }
        }
      }
    });
    const model = createTestModel(machine, { events: [{ type: 'GO' }] });
    const frontier = model.getPathsFromEvents([{ type: 'GO' }])[0];
    expect(frontier).toBeDefined();
    let failure!: PropertyTestFailure;

    try {
      await propertyTest(model, {
        adapter: fastCheckAdapter({ seed: 123, numRuns: 100, maxCommands: 5 }),
        frontiers: [frontier],
        events: {
          INC: fc.constant({ value: 10 })
        },
        invariant: ({ snapshot }) => {
          expect(snapshot.context.count).toBeLessThan(10);
        }
      });
    } catch (value) {
      failure = value as PropertyTestFailure;
    }

    expect(
      failure.fixture?.timeline
        .filter((entry) => entry.kind === 'event')
        .map((entry) => entry.command)
    ).toEqual([
      expect.objectContaining({
        phase: 'prefix',
        event: { type: 'GO' }
      }),
      expect.objectContaining({ phase: 'generated' })
    ]);
    expect(failure.trace.steps[0]).toMatchObject({
      phase: 'prefix',
      event: { type: 'GO' }
    });
  });

  it('shrinks SUT divergence and disposes every run', async () => {
    let active = 0;
    let failure!: PropertyTestFailure;
    try {
      await propertyTest(counterMachine, {
        adapter: fastCheckAdapter({ seed: 8, numRuns: 10, maxCommands: 5 }),
        events: { INC: fc.constant({ value: 1 }) },
        sut: {
          create: () => {
            active++;
            let count = 0;
            return {
              send: (event) => {
                if (event.type === 'INC') {
                  count += event.value + 1;
                }
              },
              read: () => count,
              dispose: () => {
                active--;
              }
            };
          },
          projectModel: (snapshot) => snapshot.context.count,
          projectSut: (count) => count
        },
        invariant: () => {}
      });
    } catch (error) {
      failure = error as PropertyTestFailure;
    }

    expect(failure).toBeInstanceOf(PropertyTestFailure);
    expect(failure.message).toContain('observation diverged');
    expect(failure.trace.events).toEqual([{ type: 'INC', value: 1 }]);
    expect(active).toBe(0);
  });

  it('composes shrinkable clock commands with a fresh SimulatedClock', async () => {
    const timerMachine = createMachine({
      schemas: {
        context: types<{ ticks: number }>(),
        events: { TICK: types<{}>() }
      },
      context: { ticks: 0 },
      on: {
        TICK: ({ context }) => ({ context: { ticks: context.ticks + 1 } })
      }
    });
    let created = 0;
    let disposed = 0;
    const result = await propertyTest(timerMachine, {
      adapter: fastCheckAdapter({ seed: 17, numRuns: 10, maxCommands: 3 }),
      events: {},
      commands: { advance: fc.constant(1) },
      sut: {
        create: () => {
          created++;
          const clock = new SimulatedClock();
          const value = { ticks: 0 };
          const events: { type: 'TICK' }[] = [];
          clock.setTimeout(() => {
            value.ticks++;
            events.push({ type: 'TICK' });
          }, 1);
          return {
            send: () => {},
            read: () => value,
            advance: (milliseconds) => {
              clock.increment(milliseconds);
              return events.splice(0);
            },
            dispose: () => {
              disposed++;
            }
          };
        },
        projectModel: (snapshot) => snapshot.context.ticks,
        projectSut: (value) => (value as { ticks: number }).ticks,
        equivalent: (model, sut) => model === sut
      },
      invariant: () => {}
    });

    expect(result.coverage.clockAdvances).toBeGreaterThan(0);
    expect(result.coverage.sutComparisons).toBeGreaterThan(0);
    expect(created).toBe(result.coverage.runs);
    expect(disposed).toBe(created);
  });
});
