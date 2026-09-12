import { createMachine, types } from '../../index.ts';
import {
  PropertyTestFailure,
  propertyTest,
  replayPropertyTest,
  type PortablePropertyReplayFixture,
  type PropertyTestAdapter,
  type PropertyTrace
} from '../propertyTest.ts';
import {
  generatePropertySuite,
  replayPropertySuite
} from '../propertySuite.ts';
import { runParallelPropertyCommands } from '../propertyLinearizability.ts';
import {
  constant,
  integer,
  oneOf,
  randomAdapter
} from './propertyTestAdapter.ts';

function fetchMachine() {
  return createMachine({
    id: 'fetch',
    initial: 'idle',
    schemas: { events: { FETCH: types<{}>() } },
    states: {
      idle: { on: { FETCH: { target: 'loading' } } },
      loading: {
        invoke: {
          src: 'fetcher',
          onDone: { target: 'success' },
          onError: { target: 'failure' }
        }
      },
      // Both terminal states loop back so one run resolves several actors.
      success: { on: { FETCH: { target: 'loading' } } },
      failure: { on: { FETCH: { target: 'loading' } } }
    }
  });
}

const toggleMachine = createMachine({
  id: 'toggle',
  initial: 'off',
  schemas: { events: { TOGGLE: types<{}>() } },
  states: {
    off: { on: { TOGGLE: { target: 'on' } } },
    on: { on: { TOGGLE: { target: 'off' } } }
  }
});

describe('executed replay seeding', () => {
  it('replays outcome commands without double-providing the seeded outcomes', async () => {
    const machine = fetchMachine();
    const suite = await generatePropertySuite(machine, {
      adapter: randomAdapter({ seed: 9, numRuns: 20, maxCommands: 10 }),
      mode: 'executed',
      outcomes: {
        fetcher: oneOf<any>(
          { ok: true, output: 1 },
          { ok: false, error: 'nope' }
        )
      },
      events: { FETCH: constant({}) },
      invariant: () => {}
    });

    const withOutcomes = suite.fixtures.filter(
      (fixture) =>
        fixture.timeline.filter((entry) => entry.command.type === 'outcome')
          .length > 1
    );
    expect(withOutcomes.length).toBeGreaterThan(0);

    for (const fixture of withOutcomes) {
      const trace = await replayPropertyTest(machine, fixture, {
        invariant: () => {},
        expect: 'pass'
      });
      // Each recorded outcome is resolved exactly once, in the recorded order:
      // pre-seeding a source the timeline also replays would duplicate them.
      expect(trace.outcomes).toEqual(fixture.outcomes);
    }
  });

  it('rejects an executed fixture replayed in pure mode', async () => {
    const machine = fetchMachine();
    const failure = (await propertyTest(machine, {
      adapter: randomAdapter({ seed: 5, numRuns: 20, maxCommands: 6 }),
      mode: 'executed',
      outcomes: { fetcher: constant({ ok: true, output: 1 } as any) },
      events: { FETCH: constant({}) },
      invariant: ({ snapshot }) => {
        if ((snapshot as any).value === 'success') {
          throw new Error('reached success');
        }
      }
    }).catch((cause) => cause)) as PropertyTestFailure;

    const fixture = failure.fixture as PortablePropertyReplayFixture;
    await expect(
      replayPropertyTest(machine, fixture, {
        mode: 'pure',
        invariant: () => {}
      })
    ).rejects.toThrow("pass mode: 'executed'");
  });
});

describe('property suites', () => {
  it('carries the mode and outcomes of an executed campaign into its fixtures', async () => {
    const machine = fetchMachine();
    const suite = await generatePropertySuite(machine, {
      adapter: randomAdapter({ seed: 2, numRuns: 6, maxCommands: 4 }),
      mode: 'executed',
      outcomes: { fetcher: constant({ ok: true, output: 1 } as any) },
      events: { FETCH: constant({}) },
      invariant: () => {}
    });

    expect(suite.fixtures.length).toBeGreaterThan(0);
    expect(suite.fixtures.every((fixture) => fixture.mode === 'executed')).toBe(
      true
    );
    // Replaying without an explicit mode must use the fixture's own mode.
    const result = await replayPropertySuite(machine, suite, {
      invariant: () => {}
    });
    expect(result.failed).toEqual([]);
    expect(result.passed).toBe(suite.fixtures.length);
  });

  it('titles outcome commands', async () => {
    const machine = fetchMachine();
    const suite = await generatePropertySuite(machine, {
      adapter: randomAdapter({ seed: 2, numRuns: 6, maxCommands: 4 }),
      mode: 'executed',
      outcomes: { fetcher: constant({ ok: true, output: 1 } as any) },
      events: { FETCH: constant({}) },
      invariant: () => {}
    });
    const { formatPropertySuiteFixtureTitle } =
      await import('../propertySuite.ts');
    const titles = suite.fixtures.map((fixture, index) =>
      formatPropertySuiteFixtureTitle(fixture, index)
    );
    expect(titles.some((title) => title.includes('@outcome(fetcher)'))).toBe(
      true
    );
  });
});

describe('end-of-run temporal failures', () => {
  it('reports the run that failed at finish() as not passed', async () => {
    const collected: boolean[] = [];
    const error = await propertyTest(toggleMachine, {
      adapter: randomAdapter({ seed: 1, numRuns: 1, maxCommands: 2 }),
      events: { TOGGLE: constant({}) },
      invariant: () => {},
      temporal: [
        {
          type: 'eventually',
          id: 'never-holds',
          predicate: () => false
        }
      ],
      collect: (_trace: PropertyTrace<any, any>, info) => {
        collected.push(info.passed);
      }
    }).catch((cause) => cause);

    expect(error).toBeInstanceOf(PropertyTestFailure);
    expect(collected).toEqual([false]);
  });

  it('does not record an end-of-run temporal failure in a suite', async () => {
    await expect(
      generatePropertySuite(toggleMachine, {
        adapter: randomAdapter({ seed: 1, numRuns: 1, maxCommands: 2 }),
        events: { TOGGLE: constant({}) },
        invariant: () => {},
        temporal: [
          { type: 'eventually', id: 'never-holds', predicate: () => false }
        ]
      })
    ).rejects.toBeInstanceOf(PropertyTestFailure);
  });
});

describe('pure-mode advance', () => {
  it('records a runtime entry when no SUT owns a clock', async () => {
    const { coverage } = await propertyTest(toggleMachine, {
      adapter: randomAdapter({ seed: 4, numRuns: 3, maxCommands: 6 }),
      events: { TOGGLE: constant({}) },
      commands: { advance: integer(1, 10) },
      invariant: () => {}
    });
    expect(coverage.clockAdvances).toBeGreaterThan(0);
  });
});

describe('batch exploration', () => {
  it('stops when the adapter makes no progress', async () => {
    const stalled: PropertyTestAdapter = {
      run: async () => ({
        runs: 0,
        exploration: { configuredRuns: 1, maximumSequenceLength: 1 }
      })
    };
    const { coverage } = await propertyTest(toggleMachine, {
      adapter: stalled,
      events: { TOGGLE: constant({}) },
      invariant: () => {},
      until: { runs: 50 },
      maxRuns: 100,
      batchRuns: 5
    });
    expect(coverage.exploration.truncationReasons).toContain(
      'adapter made no progress'
    );
  });
});

describe('linearizability', () => {
  it('does not prune states that share a projection', async () => {
    // `count` is the projection; `parity` distinguishes otherwise equal states.
    const machine = createMachine({
      id: 'projection',
      schemas: {
        context: types<{ count: number; toggles: number }>(),
        events: { INC: types<{}>(), TOGGLE: types<{}>() }
      },
      context: { count: 0, toggles: 0 },
      on: {
        INC: ({ context }) => ({
          context: { ...context, count: context.count + 1 }
        }),
        TOGGLE: ({ context }) => ({
          context: { ...context, toggles: context.toggles + 1 }
        })
      }
    });

    let count = 0;
    const result = await runParallelPropertyCommands(machine as any, {
      branches: [[{ type: 'INC' } as any], [{ type: 'TOGGLE' } as any]],
      sut: {
        create: () => ({
          send: (event: any) => {
            if (event.type === 'INC') {
              count++;
            }
            return count;
          }
        }),
        projectModel: (snapshot: any) => snapshot.context.count
      }
    });

    expect(result.linearizable).toBe(true);
  });

  it('passes a usable label recorder context to the SUT', async () => {
    let classified = false;
    const result = await runParallelPropertyCommands(toggleMachine as any, {
      branches: [[{ type: 'TOGGLE' } as any]],
      sut: {
        create: (context) => {
          context.classify(true, 'created');
          context.label('created');
          context.target(1);
          classified = true;
          return { send: () => undefined, read: () => 'on' };
        },
        projectModel: (snapshot: any) => snapshot.value
      }
    });

    expect(classified).toBe(true);
    expect(result.linearizable).toBe(true);
  });
});
