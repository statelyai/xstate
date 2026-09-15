import * as fc from 'fast-check';
import { createAsyncLogic, createMachine, types } from 'xstate';
import {
  PropertyTestFailure,
  propertyTest,
  replayPropertyTest,
  type PortablePropertyReplayFixture
} from 'xstate/graph';
import { fastCheckAdapter } from '../src/index.ts';

const outcomeArbitrary = fc.oneof(
  fc.record({ ok: fc.constant(true as const), output: fc.integer() }),
  fc.record({ ok: fc.constant(false as const), error: fc.constant('boom') })
);

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
      success: {},
      failure: {}
    }
  });
}

describe('executed mode', () => {
  it('covers both invoke branches through generated outcomes', async () => {
    const { coverage } = await propertyTest(fetchMachine(), {
      adapter: fastCheckAdapter({ seed: 4, numRuns: 60, maxCommands: 4 }),
      mode: 'executed',
      outcomes: { fetcher: outcomeArbitrary },
      events: { FETCH: fc.constant({}) },
      invariant: () => {}
    });

    expect(coverage.exploration.mode).toBe('executed');
    expect(coverage.stateNodes.covered).toEqual(
      expect.arrayContaining(['fetch.success', 'fetch.failure'])
    );
    expect(coverage.transitions.uncovered).toEqual([]);
  });

  it('reaches a delayed transition with generated advance commands', async () => {
    const machine = createMachine({
      id: 'timeout',
      initial: 'idle',
      schemas: { events: { START: types<{}>() } },
      states: {
        idle: { on: { START: { target: 'waiting' } } },
        waiting: { after: { 500: { target: 'expired' } } },
        expired: {}
      }
    });

    const { coverage } = await propertyTest(machine, {
      adapter: fastCheckAdapter({ seed: 9, numRuns: 60, maxCommands: 4 }),
      mode: 'executed',
      events: { START: fc.constant({}) },
      commands: { advance: fc.integer({ min: 100, max: 900 }) },
      invariant: () => {}
    });

    expect(coverage.stateNodes.covered).toContain('timeout.expired');
  });

  it('runs an invoked child actor and reports its snapshots', async () => {
    const ticker = createMachine({
      id: 'ticker',
      context: { count: 0 },
      initial: 'ticking',
      states: {
        ticking: {
          after: {
            100: ({ context }: any) => ({
              target: 'ticking',
              context: { count: context.count + 1 }
            })
          }
        }
      }
    });

    const machine = createMachine({
      id: 'parent',
      initial: 'running',
      context: { observed: 0 },
      schemas: { events: { NOOP: types<{}>() } },
      states: {
        running: {
          invoke: {
            id: 'ticker',
            src: 'ticker',
            onSnapshot: ({ event }: any) => ({
              context: { observed: event.snapshot.context.count }
            })
          },
          on: { NOOP: {} }
        }
      }
    });

    let sawObserved = false;
    await propertyTest(machine as any, {
      adapter: fastCheckAdapter({ seed: 2, numRuns: 20, maxCommands: 4 }),
      mode: 'executed',
      actors: { ticker: ticker as any },
      events: { NOOP: fc.constant({}) },
      commands: { advance: fc.integer({ min: 100, max: 300 }) },
      invariant: ({ snapshot }: any) => {
        if (snapshot.context.observed > 0) {
          sawObserved = true;
        }
      }
    });

    expect(sawObserved).toBe(true);
  });

  it('replays an executed failure without the real service', async () => {
    const machine = fetchMachine();
    let calls = 0;

    const failure = (await propertyTest(machine, {
      adapter: fastCheckAdapter({ seed: 6, numRuns: 20, maxCommands: 3 }),
      mode: 'executed',
      actors: {
        fetcher: createAsyncLogic({
          run: async () => {
            calls++;
            return 'ok';
          }
        })
      },
      events: { FETCH: fc.constant({}) },
      invariant: ({ snapshot }: any) => {
        if (snapshot.value === 'success') {
          throw new Error('reached success');
        }
      }
    }).catch((cause) => cause)) as PropertyTestFailure;

    expect(failure).toBeInstanceOf(PropertyTestFailure);
    const fixture = failure.fixture as PortablePropertyReplayFixture;
    expect(fixture.mode).toBe('executed');
    expect(fixture.outcomes?.length).toBeGreaterThan(0);

    calls = 0;
    await expect(
      replayPropertyTest(machine, fixture, {
        invariant: ({ snapshot }: any) => {
          if (snapshot.value === 'success') {
            throw new Error('reached success');
          }
        }
      })
    ).rejects.toThrow(PropertyTestFailure);
    expect(calls).toBe(0);
  });

  it('is deterministic for one seed', async () => {
    const run = async () => {
      const values: string[] = [];
      await propertyTest(fetchMachine(), {
        adapter: fastCheckAdapter({ seed: 13, numRuns: 25, maxCommands: 4 }),
        mode: 'executed',
        outcomes: { fetcher: outcomeArbitrary },
        events: { FETCH: fc.constant({}) },
        invariant: ({ snapshot }: any) => {
          values.push(JSON.stringify(snapshot.value));
        }
      });
      return values.join('|');
    };

    expect(await run()).toBe(await run());
  });
});
