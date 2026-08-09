import * as fc from 'fast-check';
import { createMachine, SimulatedClock, types } from 'xstate';
import {
  PropertyTestFailure,
  createTestModel,
  propertyTest,
  replayPropertyTest,
  type PropertyTestAdapter
} from 'xstate/graph';
import { fastCheckAdapter } from '../src/index.ts';

describe('advanced property testing', () => {
  it('records exact parallel, guarded, and eventless transitions', async () => {
    const machine = createMachine({
      id: 'topology',
      schemas: {
        events: {
          GO: types<{ allow: boolean }>(),
          NEXT: types<{}>(),
          UNUSED: types<{}>(),
          DYNAMIC: types<{}>()
        }
      },
      type: 'parallel',
      states: {
        left: {
          initial: 'idle',
          states: {
            idle: {
              on: {
                GO: [
                  {
                    guard: ({ event }: { event: { allow: boolean } }) =>
                      event.allow,
                    target: 'allowed'
                  },
                  { target: 'denied' }
                ] as any,
                UNUSED: { target: 'idle' },
                DYNAMIC: () => ({ target: 'allowed' })
              }
            },
            allowed: {},
            denied: {},
            unreachable: { on: { NEXT: { target: 'unreachable' } } }
          }
        },
        right: {
          initial: 'idle',
          states: {
            idle: { on: { GO: { target: 'settling' } } },
            settling: { always: { target: 'done' } },
            done: {}
          }
        }
      }
    });

    const result = await propertyTest(machine, {
      adapter: fastCheckAdapter({ seed: 21, numRuns: 50, maxCommands: 1 }),
      events: {
        GO: fc.record({ allow: fc.boolean() }),
        NEXT: fc.constant({})
      },
      invariant: () => {}
    });

    const goTransitions = result.coverage.transitions.covered.filter((id) =>
      id.includes('GO')
    );
    expect(goTransitions).toHaveLength(3);
    expect(Object.values(result.coverage.guards.outcomes)).toContainEqual({
      passed: expect.any(Number),
      failed: expect.any(Number)
    });
    expect(
      Object.values(result.coverage.guards.outcomes).some(
        ({ passed, failed }) => passed > 0 && failed > 0
      )
    ).toBe(true);
    expect(result.coverage.transitions.covered).toEqual(
      expect.arrayContaining([expect.stringContaining('@eventless')])
    );
    expect(result.coverage.stateNodes.unreachable).toContain(
      'topology.left.unreachable'
    );
    expect(result.coverage.transitions.uncovered).toEqual(
      expect.arrayContaining([expect.stringContaining('UNUSED')])
    );
    expect(result.coverage.transitions.unreachable).toEqual(
      expect.arrayContaining([expect.stringContaining('NEXT')])
    );
    expect(result.coverage.transitions.unknown).toEqual(
      expect.arrayContaining([expect.stringContaining('DYNAMIC')])
    );
    expect(result.coverage.states.unknown).toContain(
      '(runtime serialized states)'
    );
  });

  it('keeps SCXML macrostep transition coverage distinct from visitation', async () => {
    const machine = createMachine({
      id: 'macrostep',
      initial: 'a',
      states: {
        a: { on: { GO: { target: 'b' } } },
        b: { always: { target: 'c' } },
        c: {}
      }
    });
    let failure!: PropertyTestFailure;
    try {
      await propertyTest(machine, {
        adapter: fastCheckAdapter({ seed: 1, numRuns: 10, maxCommands: 1 }),
        events: { GO: fc.constant({}) },
        invariant: ({ event }) => {
          if (event?.type === 'GO') {
            throw new Error('capture');
          }
        }
      });
    } catch (error) {
      failure = error as PropertyTestFailure;
    }

    expect(failure.trace.steps).toHaveLength(1);
    expect(failure.trace.steps[0].transitionIds).toHaveLength(2);
    expect(failure.trace.steps[0].activeStateIds).toContain('macrostep.c');
  });

  it('selects frontiers, applies per-frontier budgets, and preserves prefixes while shrinking', async () => {
    const machine = createMachine({
      id: 'frontiers',
      schemas: {
        context: types<{ count: number }>(),
        events: {
          ACTIVATE: types<{}>(),
          INC: types<{ value: number }>()
        }
      },
      context: { count: 0 },
      initial: 'idle',
      states: {
        idle: { on: { ACTIVATE: { target: 'active' } } },
        active: {
          on: {
            INC: ({ context, event }) => ({
              context: { count: context.count + event.value }
            })
          }
        }
      }
    });
    const model = createTestModel(machine, {
      events: [{ type: 'ACTIVATE' }],
      serializeState: (snapshot) => JSON.stringify(snapshot.value)
    });
    const frontiers = model
      .getShortestPaths()
      .filter(
        (path) =>
          path.steps.filter(
            (step) => (step.event.type as string) !== '@xstate.init'
          ).length === 1 &&
          path.steps.some((step) => step.event.type === 'ACTIVATE')
      );
    const successful = await propertyTest(model, {
      adapter: fastCheckAdapter({ seed: 3, numRuns: 100, maxCommands: 1 }),
      frontiers: {
        paths: frontiers,
        select: ({ index }) => index === 0,
        runsPerFrontier: 3
      },
      events: { INC: fc.constant({ value: 0 }) },
      invariant: () => {}
    });
    expect(successful.coverage.runs).toBe(3);
    expect(successful.coverage.prefixSteps).toBe(3);
    expect(successful.coverage.frontiers.covered).toHaveLength(1);

    let failure!: PropertyTestFailure;
    try {
      await propertyTest(model, {
        adapter: fastCheckAdapter({ seed: 9, numRuns: 100, maxCommands: 8 }),
        frontiers: { paths: frontiers, runsPerFrontier: 100 },
        events: { INC: fc.record({ value: fc.integer({ min: 1, max: 20 }) }) },
        invariant: ({ snapshot }) => {
          expect(snapshot.context.count).toBeLessThan(1);
        }
      });
    } catch (error) {
      failure = error as PropertyTestFailure;
    }
    expect(failure.trace.prefixEvents).toEqual([{ type: 'ACTIVATE' }]);
    expect(failure.trace.events).toHaveLength(1);
    expect(failure.fixture?.timeline[0].command).toMatchObject({
      type: 'event',
      phase: 'prefix',
      event: { type: 'ACTIVATE' }
    });
  });

  it('shrinks independent reference divergence with model, oracle, and SUT observations', async () => {
    const machine = createMachine({
      id: 'reference',
      schemas: {
        context: types<{ count: number }>(),
        events: { ADD: types<{ value: number }>() }
      },
      context: { count: 0 },
      on: {
        ADD: ({ context, event }) => ({
          context: { count: context.count + event.value }
        })
      }
    });
    let failure!: PropertyTestFailure;
    try {
      await propertyTest(machine, {
        adapter: fastCheckAdapter({ seed: 11, numRuns: 50, maxCommands: 8 }),
        events: { ADD: fc.record({ value: fc.integer({ min: 1, max: 50 }) }) },
        reference: {
          create: () => {
            let count = 0;
            return {
              transition: (event) => {
                count += event.value + 1;
              },
              read: () => count
            };
          },
          projectModel: (snapshot) => snapshot.context.count
        },
        sut: {
          create: () => {
            let count = 0;
            return {
              send: (event) => {
                count += event.value;
              },
              read: () => count
            };
          },
          projectModel: (snapshot) => snapshot.context.count
        },
        invariant: () => {}
      });
    } catch (error) {
      failure = error as PropertyTestFailure;
    }

    expect(failure).toBeInstanceOf(PropertyTestFailure);
    expect(failure.trace.events).toHaveLength(1);
    expect(failure.cause).toMatchObject({
      model: expect.any(Number),
      oracle: expect.any(Number),
      sut: expect.any(Number),
      oracleMatches: false,
      sutMatches: true
    });
    expect(failure.trace.timeline.at(-1)?.observation).toMatchObject({
      model: expect.any(Number),
      oracle: expect.any(Number),
      sut: expect.any(Number)
    });
  });

  it('replays temporal failures and chronological runtime commands portably', async () => {
    const machine = createMachine({
      id: 'timeline',
      version: '1',
      schemas: {
        context: types<{ ticks: number }>(),
        events: { GO: types<{}>(), TICK: types<{}>() }
      },
      context: { ticks: 0 },
      on: {
        TICK: ({ context }) => ({ context: { ticks: context.ticks + 1 } })
      }
    });
    const adapter = {
      run: async (request: any) => {
        const runner = request.createRunner();
        try {
          await runner.start();
          await runner.run({ type: 'GO' });
          await runner.advance(1);
          await runner.checkpoint('after-tick');
          await runner.stop();
          await runner.finish();
          return { runs: 1 };
        } catch (error) {
          return { runs: 1, error };
        } finally {
          await runner.dispose();
        }
      }
    } as PropertyTestAdapter;
    let disposed = 0;
    let failure!: PropertyTestFailure;
    try {
      await propertyTest(machine, {
        adapter,
        events: { GO: undefined },
        sut: {
          create: () => {
            const clock = new SimulatedClock();
            const events: { type: 'TICK' }[] = [];
            let ticks = 0;
            let stopped = false;
            clock.setTimeout(() => {
              ticks++;
              events.push({ type: 'TICK' });
            }, 1);
            return {
              send: () => {},
              advance: (milliseconds) => {
                clock.increment(milliseconds);
                return events.splice(0);
              },
              checkpoint: async () => Promise.resolve(),
              stop: () => {
                stopped = true;
              },
              settle: async () => Promise.resolve(),
              read: () => ({ ticks, status: stopped ? 'stopped' : 'active' }),
              dispose: () => {
                disposed++;
              }
            };
          },
          projectModel: (snapshot) => ({
            ticks: snapshot.context.ticks,
            status: snapshot.status
          })
        },
        temporal: [
          {
            type: 'until',
            id: 'stay-active',
            within: 10,
            hold: ({ snapshot }) => snapshot.status === 'active',
            until: () => false
          }
        ],
        invariant: () => {}
      });
    } catch (error) {
      failure = error as PropertyTestFailure;
    }

    expect(failure.fixture?.temporalFailure).toMatchObject({
      type: 'until',
      id: 'stay-active'
    });
    expect(
      failure.fixture?.timeline.map((entry) =>
        entry.command.type === 'event'
          ? `${entry.command.type}:${entry.command.origin}`
          : entry.command.type
      )
    ).toEqual([
      'event:generator',
      'advance',
      'event:clock',
      'checkpoint',
      'stop'
    ]);
    expect(disposed).toBe(1);

    let replayFailure!: PropertyTestFailure;
    try {
      await replayPropertyTest(machine, failure.fixture!, {
        invariant: () => {},
        temporal: [
          {
            type: 'until',
            id: 'stay-active',
            within: 10,
            hold: ({ snapshot }) => snapshot.status === 'active',
            until: () => false
          }
        ]
      });
    } catch (error) {
      replayFailure = error as PropertyTestFailure;
    }
    expect(replayFailure).toBeInstanceOf(PropertyTestFailure);
    expect(replayFailure.fixture?.temporalFailure?.id).toBe('stay-active');

    const incompatible = createMachine({ id: 'timeline', version: '2' });
    await expect(
      replayPropertyTest(incompatible, failure.fixture!, {
        invariant: () => {}
      })
    ).rejects.toThrow('machine version');
  });

  it('checks bounded eventuality over stable macrosteps', async () => {
    const machine = createMachine({
      schemas: {
        context: types<{ count: number }>(),
        events: { INC: types<{}>() }
      },
      context: { count: 0 },
      on: {
        INC: ({ context }) => ({ context: { count: context.count + 1 } })
      }
    });
    const adapter = {
      run: async (request: any) => {
        const runner = request.createRunner();
        try {
          await runner.start();
          await runner.run({ type: 'INC' });
          await runner.run({ type: 'INC' });
          await runner.finish();
          return { runs: 1 };
        } finally {
          await runner.dispose();
        }
      }
    } as PropertyTestAdapter;

    const result = await propertyTest(machine, {
      adapter,
      events: { INC: undefined },
      temporal: [
        {
          type: 'eventually',
          id: 'reach-two',
          within: 2,
          predicate: ({ snapshot }) => snapshot.context.count === 2
        }
      ],
      invariant: () => {}
    });
    expect(result.coverage.temporalChecks).toBe(3);
  });

  it('shrinks generated checkpoint and stop commands', async () => {
    const machine = createMachine({});
    let checkpointFailure!: PropertyTestFailure;
    let active = 0;
    let created = 0;
    try {
      await propertyTest(machine, {
        adapter: fastCheckAdapter({ seed: 31, numRuns: 50, maxCommands: 6 }),
        events: {},
        commands: {
          checkpoint: fc.record({ label: fc.string() })
        },
        sut: {
          create: () => {
            created++;
            active++;
            let valid = true;
            return {
              send: () => {},
              checkpoint: () => {
                valid = false;
              },
              read: () => valid,
              dispose: () => {
                active--;
              }
            };
          },
          projectModel: () => true
        },
        invariant: () => {}
      });
    } catch (error) {
      checkpointFailure = error as PropertyTestFailure;
    }
    expect(checkpointFailure.trace.commands).toHaveLength(1);
    expect(checkpointFailure.trace.commands[0]).toMatchObject({
      type: 'checkpoint'
    });
    expect(created).toBeGreaterThan(1);
    expect(active).toBe(0);

    let stopFailure!: PropertyTestFailure;
    try {
      await propertyTest(machine, {
        adapter: fastCheckAdapter({ seed: 32, numRuns: 50, maxCommands: 6 }),
        events: {},
        commands: { stop: fc.constant({}) },
        invariant: ({ snapshot }) => {
          expect(snapshot.status).not.toBe('stopped');
        }
      });
    } catch (error) {
      stopFailure = error as PropertyTestFailure;
    }
    expect(stopFailure.trace.commands).toEqual([{ type: 'stop' }]);
  });

  it('creates and disposes fresh asynchronous runtimes across shrinking attempts', async () => {
    const machine = createMachine({
      schemas: {
        context: types<{ count: number }>(),
        events: { INC: types<{}>() }
      },
      context: { count: 0 },
      on: {
        INC: ({ context }) => ({ context: { count: context.count + 1 } })
      }
    });
    let created = 0;
    let disposed = 0;
    let active = 0;
    await propertyTest(machine, {
      adapter: fastCheckAdapter({ seed: 27, numRuns: 20, maxCommands: 5 }),
      events: { INC: fc.constant({}) },
      sut: {
        create: () => {
          created++;
          active++;
          const clock = new SimulatedClock();
          expect(clock.now()).toBe(0);
          let count = 0;
          const pending: (() => void)[] = [];
          return {
            send: () => {
              pending.push(() => count++);
            },
            settle: async () => {
              await Promise.resolve();
              pending.splice(0).forEach((run) => run());
            },
            read: () => count,
            dispose: () => {
              disposed++;
              active--;
            }
          };
        },
        projectModel: (snapshot) => snapshot.context.count
      },
      invariant: () => {}
    });
    expect(created).toBeGreaterThan(1);
    expect(disposed).toBe(created);
    expect(active).toBe(0);
  });
});
