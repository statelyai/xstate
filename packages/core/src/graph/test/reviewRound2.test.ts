import { createAsyncLogic, createMachine, types } from '../../index.ts';
import * as graph from '../index.ts';
import {
  formatTestCoverage,
  ModelTestFailure,
  propertyTest,
  replayTest,
  testPaths,
  type TestFixture,
  type TestTrace
} from '../index.ts';
import { constant, randomAdapter } from './propertyTestAdapter.ts';

const lightMachine = createMachine({
  id: 'light',
  initial: 'green',
  states: {
    green: { on: { NEXT: { target: 'yellow' } } },
    yellow: { on: { NEXT: { target: 'red' } } },
    red: {
      initial: 'walk',
      states: {
        walk: { on: { NEXT: { target: 'stop' } } },
        stop: { id: 'stopSign' }
      }
    }
  }
});

async function captureFailure(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof ModelTestFailure) {
      return error;
    }
    throw error;
  }
  throw new Error('expected a ModelTestFailure');
}

describe('`states` keys with a plain machine', () => {
  const recordStates = () => {
    const seen = new Set<string>();
    const states = Object.fromEntries(
      ['green', 'red', 'red.walk', '#stopSign', '*'].map((key) => [
        key,
        () => {
          seen.add(key);
        }
      ])
    );
    return { seen, states };
  };

  it('runs value, nested value, and `#id` keys in propertyTest()', async () => {
    const { seen, states } = recordStates();
    await propertyTest(lightMachine, {
      adapter: randomAdapter({ seed: 1, numRuns: 10, maxCommands: 4 }),
      events: { NEXT: constant({}) },
      states
    });

    expect([...seen].sort()).toEqual(
      ['#stopSign', '*', 'green', 'red', 'red.walk'].sort()
    );
  });

  it('runs them in testPaths(), top-level and on the session', async () => {
    const topLevel = recordStates();
    await testPaths(lightMachine, { states: topLevel.states });
    expect(topLevel.seen.has('red.walk')).toBe(true);
    expect(topLevel.seen.has('#stopSign')).toBe(true);

    const session = recordStates();
    await testPaths(lightMachine, {
      sut: { create: () => ({ send: () => {}, states: session.states }) }
    });
    expect(session.seen.has('green')).toBe(true);
    expect(session.seen.has('#stopSign')).toBe(true);
  });

  it('runs them in replayTest()', async () => {
    const failure = await captureFailure(() =>
      propertyTest(lightMachine, {
        adapter: randomAdapter({ seed: 3, numRuns: 20, maxCommands: 5 }),
        events: { NEXT: constant({}) },
        invariant: ({ snapshot }) => {
          expect(snapshot.matches('red.stop')).toBe(false);
        }
      })
    );
    const { seen, states } = recordStates();
    await replayTest(lightMachine, failure.fixture!, {
      states,
      expect: 'pass'
    });

    expect(seen.has('red.walk')).toBe(true);
    expect(seen.has('#stopSign')).toBe(true);
  });
});

describe('testPaths() follows the planned path', () => {
  const raceMachine = createMachine({
    id: 'race',
    initial: 's',
    states: {
      s: { after: { 100: { target: 'x' }, 200: { target: 'y' } } },
      x: {},
      y: {}
    }
  });

  it('offers only the timer that is due first', async () => {
    for (const mode of ['pure', 'executed'] as const) {
      const { coverage, results } = await testPaths(raceMachine, { mode });

      expect(results.every(({ passed }) => passed)).toBe(true);
      expect(results.map(({ path }) => path.state.value)).not.toContain('y');
      expect(coverage.transitions.uncovered).toEqual([
        '["transition","race.s","xstate.after",1]'
      ]);
    }
  });

  it('fails a path the run departs from', async () => {
    const failure = await captureFailure(() =>
      testPaths(raceMachine, {
        mode: 'executed',
        fromEvents: [
          { type: 'xstate.after', delay: 200, stateId: 'race.s' } as never
        ]
      })
    );

    expect(failure.summary).toBe(
      'Path 1 (xstate.after) failed: path diverged at step 1: expected {"value":"y","context":{}}, got {"value":"x","context":{}}'
    );
  });

  it('fails instead of skipping an event that is no longer applicable', async () => {
    const failure = await captureFailure(() =>
      testPaths(lightMachine, {
        // The path below was planned without this `when`; the run applies it.
        events: { NEXT: { generate: () => ({}), when: () => false } },
        paths: [
          {
            state: lightMachine.resolveState({ value: 'yellow' }) as never,
            steps: [
              {
                state: lightMachine.resolveState({ value: 'green' }) as never,
                event: { type: '@xstate.init' } as never
              },
              {
                state: lightMachine.resolveState({ value: 'yellow' }) as never,
                event: { type: 'NEXT' }
              }
            ],
            weight: 1
          }
        ]
      })
    );

    expect(failure.summary).toMatch(
      /^Path 1 \(NEXT\) failed: path diverged at step 1: NEXT could not be sent/
    );
  });

  it('counts time spent in enclosing states towards nested timers', async () => {
    const nestedMachine = createMachine({
      id: 'nested',
      initial: 'p',
      states: {
        p: {
          initial: 'a',
          after: { 200: { target: 'done' } },
          states: {
            a: { after: { 100: { target: 'b' } } },
            b: { after: { 150: { target: 'c' } } },
            c: {}
          }
        },
        done: {}
      }
    });
    const advances: number[][] = [];
    const { coverage, results } = await testPaths(nestedMachine, {
      mode: 'executed',
      collect: (trace) => {
        advances.push(
          trace.commands.flatMap((command) =>
            command.type === 'advance' ? [command.milliseconds] : []
          )
        );
      }
    });

    expect(results.every(({ passed }) => passed)).toBe(true);
    // `p.b` is entered at t=100, so `p`'s 200ms timer is due 100ms later,
    // before `b`'s 150ms one: `c` is never reached.
    expect(results.map(({ path }) => path.state.value)).not.toContainEqual({
      p: 'c'
    });
    expect(advances).toContainEqual([100, 100]);
    expect(coverage.transitions.uncovered).toEqual([
      '["transition","nested.p.b","xstate.after",0]'
    ]);
  });
});

describe('testPaths() with invoke sources', () => {
  const fetchMachine = (fetcher?: unknown) =>
    createMachine({
      id: 'fetch',
      schemas: { events: { FETCH: types<{}>() } },
      ...(fetcher ? { actors: { fetcher: fetcher as never } } : {}),
      initial: 'idle',
      states: {
        idle: { on: { FETCH: { target: 'loading' } } },
        loading: {
          invoke: {
            src: 'fetcher',
            onDone: { target: 'success' },
            onError: { target: 'failure' }
          }
        },
        success: {},
        failure: {}
      }
    });

  it('needs no implementation for a source named in `outcomes`', async () => {
    const outcomes = {
      fetcher: () => ({ ok: true as const, output: 1 })
    };
    for (const mode of ['pure', 'executed'] as const) {
      const { results } = await testPaths(fetchMachine(), {
        mode,
        events: { FETCH: () => ({}) },
        outcomes
      });
      expect(results.every(({ passed }) => passed)).toBe(true);
    }
  });

  it('records stubbed sources in the fixture, resolved or not', async () => {
    // The real service resolves at once; the stubbed run stays in `loading`.
    const machine = fetchMachine(createAsyncLogic({ run: async () => 'real' }));
    const createSut = () => {
      let sent = false;
      return {
        create: () => ({
          send: () => {
            sent = true;
          },
          read: () => (sent ? 'success' : 'idle')
        }),
        projectModel: (snapshot: { value: unknown }) => snapshot.value
      };
    };
    const failure = await captureFailure(() =>
      testPaths(machine, {
        mode: 'executed',
        events: { FETCH: () => ({}) },
        sut: createSut()
      })
    );

    expect(failure.fixture?.stubs).toEqual(['fetcher']);
    const fixture = JSON.parse(JSON.stringify(failure.fixture)) as TestFixture;
    await expect(
      replayTest(machine, fixture, { sut: createSut() })
    ).rejects.toBeInstanceOf(ModelTestFailure);
  });

  it('records synthesized errors as portable data', async () => {
    const failure = await captureFailure(() =>
      testPaths(fetchMachine(), {
        events: { FETCH: () => ({}) },
        outcomes: { fetcher: () => ({ ok: true as const, output: 1 }) },
        invariant: ({ snapshot }) => {
          expect(snapshot.value).not.toBe('failure');
        }
      })
    );
    const errorEvent = failure.fixture!.timeline.find(
      (entry) =>
        entry.command.type === 'event' &&
        entry.command.event.type === 'xstate.error.actor'
    )!.command as unknown as { event: { error: unknown } };

    expect(errorEvent.event.error).toEqual({
      xstate$$error: true,
      name: 'Error',
      message: 'generated failure'
    });
    const fixture = JSON.parse(JSON.stringify(failure.fixture)) as TestFixture;
    const failureAgain = await captureFailure(() =>
      // Pure mode never runs the service, but the machine must name one.
      replayTest(
        fetchMachine(createAsyncLogic({ run: async () => 1 })),
        fixture,
        {
          invariant: ({ snapshot }) => {
            expect(snapshot.value).not.toBe('failure');
          }
        }
      )
    );
    const replayed = failureAgain.trace.steps.at(-1)!.event as unknown as {
      error: unknown;
    };
    expect(replayed.error).toBeInstanceOf(Error);
    expect((replayed.error as Error).message).toBe('generated failure');
  });
});

describe('testPaths() traversal bound', () => {
  it('names `limit` and `serializeState` when the context is unbounded', async () => {
    const counterMachine = createMachine({
      schemas: { context: types<{ count: number }>() },
      context: { count: 0 },
      on: {
        INC: ({ context }) => ({ context: { count: context.count + 1 } })
      }
    });

    await expect(testPaths(counterMachine, { limit: 500 })).rejects.toThrow(
      /exceeded `limit` \(500 traversal steps\).*`serializeState`/
    );
    await expect(testPaths(counterMachine)).rejects.toThrow(
      /exceeded `limit` \(10000 traversal steps\)/
    );
    const { results } = await testPaths(counterMachine, {
      stopWhen: (snapshot) => snapshot.context.count >= 3
    });
    expect(results).toHaveLength(1);
  });
});

describe('executed-mode settling', () => {
  const tickMachine = (delay: number) =>
    createMachine({
      id: 'tick',
      schemas: { events: { START: types<{}>() } },
      actors: {
        tick: createAsyncLogic({
          run: () =>
            new Promise<number>((resolve) =>
              setTimeout(() => resolve(1), delay)
            )
        })
      },
      initial: 'idle',
      states: {
        idle: { on: { START: { target: 'running' } } },
        running: { invoke: { src: 'tick', onDone: { target: 'done' } } },
        done: {}
      }
    });

  const runOnce = async (delay: number) => {
    const traces: TestTrace<any, any>[] = [];
    const { coverage } = await propertyTest(tickMachine(delay), {
      adapter: randomAdapter({ seed: 5, numRuns: 1, maxCommands: 1 }),
      mode: 'executed',
      events: { START: constant({}) },
      collect: (trace) => {
        traces.push(trace);
      }
    });
    return { coverage, trace: traces[0] };
  };

  it('settles a `setTimeout(0)` service within the step that started it', async () => {
    const first = await runOnce(0);
    const second = await runOnce(0);

    for (const { coverage, trace } of [first, second]) {
      expect(trace.finalSnapshot.value).toBe('done');
      expect(coverage.exploration.pendingActorSteps).toBe(0);
    }
    expect(second.trace.timeline.map((entry) => entry.kind)).toEqual(
      first.trace.timeline.map((entry) => entry.kind)
    );
  });

  it('reports a service still in flight when the step settles', async () => {
    const { coverage, trace } = await runOnce(200);
    const entry = trace.timeline.find(
      (candidate) => candidate.kind === 'event'
    );

    expect(trace.finalSnapshot.value).toBe('running');
    expect(coverage.exploration.pendingActorSteps).toBe(1);
    expect(
      entry && 'pendingActors' in entry ? entry.pendingActors : undefined
    ).toHaveLength(1);
  });
});

describe('testPaths() coverage report', () => {
  it('reports that every path ran, without truncation or placeholders', async () => {
    const { coverage } = await testPaths(lightMachine);
    const report = formatTestCoverage(coverage);

    expect(coverage.exploration.stoppedBecause).toBe('paths');
    expect(coverage.exploration.truncated).toBe(false);
    expect(report).toContain('stopped because: paths');
    expect(report).not.toContain('truncated');
    expect(report).not.toContain('(runtime');
    expect(report).toContain(
      'states: 4/4 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown'
    );
  });
});

describe('failure messages', () => {
  it('lead with the path, then the fixture line, then the trace', async () => {
    const failure = await captureFailure(() =>
      testPaths(lightMachine, {
        states: {
          'red.walk': () => {
            throw new Error('no walking');
          }
        }
      })
    );

    expect(failure.message).toMatchInlineSnapshot(`
      "Path 1 (NEXT → NEXT → NEXT) failed: state assertion failed after 2 steps: no walking
      Fixture: failure.fixture (replayTest)

      start {"value":"green","context":{}}
      1. generator NEXT -> {"value":"yellow","context":{}}
      2. generator NEXT -> {"value":{"red":"walk"},"context":{}}"
    `);
  });

  it('label timers and outcomes, and honor `formatSnapshot`', async () => {
    const machine = createMachine({
      id: 'order',
      schemas: { events: { PAY: types<{}>() } },
      initial: 'idle',
      states: {
        idle: { on: { PAY: { target: 'paying' } } },
        paying: {
          invoke: { src: 'charge', onDone: { target: 'paid' } }
        },
        paid: { after: { 1000: { target: 'archived' } } },
        archived: {}
      }
    });
    const failure = await captureFailure(() =>
      testPaths(machine, {
        mode: 'executed',
        events: { PAY: () => ({}) },
        outcomes: { charge: () => ({ ok: true as const, output: 'ch_1' }) },
        formatSnapshot: (snapshot) => snapshot.value,
        states: {
          archived: () => {
            throw new Error('archived too early');
          }
        }
      })
    );

    expect(failure.message).toMatchInlineSnapshot(`
      "Path 1 (PAY → xstate.done.actor → xstate.after) failed: state assertion failed after 3 steps: archived too early
      Fixture: failure.fixture (replayTest)

      start "idle"
      1. generator PAY -> "paying"
      2. outcome charge {"ok":true,"output":"ch_1"} -> "paid"
         ↳ outcome xstate.done.actor {"output":"ch_1","actorId":"0.order.paying"} -> "paid"
      3. timer advance 1000ms -> "archived"
         ↳ timer xstate.after.1000.order.paid -> "archived""
    `);
  });
});

describe('xstate/graph exports', () => {
  it('does not export internal helpers', () => {
    for (const name of [
      'fnv1a',
      'createSeededRng',
      'assertNotTestParam',
      'PropertyOutcomeRegistry'
    ]) {
      expect(name in graph).toBe(false);
    }
  });
});

describe('pre-2.0 option shape', () => {
  it('accepts `(rng) => payload` generators with top-level `states` and no `sut`', async () => {
    const seen: string[] = [];
    await testPaths(lightMachine, {
      events: { NEXT: () => ({}) },
      states: {
        yellow: () => {
          seen.push('yellow');
        }
      }
    });

    expect(seen).toContain('yellow');
  });

  it('still explains an executor passed as a generator', async () => {
    await expect(
      testPaths(lightMachine, {
        events: { NEXT: (async () => {}) as never },
        states: { yellow: () => {} }
      })
    ).rejects.toThrow(/pre-2\.0 event executor/);
  });
});
