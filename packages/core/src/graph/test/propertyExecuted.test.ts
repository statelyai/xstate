import { createAsyncLogic, createMachine, types } from '../../index.ts';
import { propertyTest, replayPropertyTest } from '../propertyTest.ts';
import type { PortablePropertyReplayFixture } from '../propertyTest.ts';
import { PropertyTestFailure } from '../propertyTest.ts';
import {
  constant,
  integer,
  oneOf,
  randomAdapter,
  record
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
      success: {},
      failure: {}
    }
  });
}

describe('executed property mode', () => {
  it('runs invoked actors and reaches both onDone and onError', async () => {
    const { coverage } = await propertyTest(fetchMachine(), {
      adapter: randomAdapter({ seed: 7, numRuns: 30, maxCommands: 4 }),
      mode: 'executed',
      outcomes: {
        fetcher: oneOf<any>(
          { ok: true, output: { user: 'David' } },
          { ok: false, error: new Error('nope') }
        )
      },
      events: { FETCH: constant({}) },
      invariant: () => {}
    });

    expect(coverage.exploration.mode).toBe('executed');
    const covered = coverage.transitions.covered.join('\n');
    expect(covered).toContain('xstate.done.actor');
    expect(covered).toContain('xstate.error.actor');
  });

  it('reaches a delayed transition through generated advance commands', async () => {
    const machine = createMachine({
      id: 'timer',
      initial: 'idle',
      schemas: { events: { START: types<{}>() } },
      states: {
        idle: { on: { START: { target: 'waiting' } } },
        waiting: { after: { 500: { target: 'elapsed' } } },
        elapsed: {}
      }
    });

    let sawElapsed = false;
    const { coverage } = await propertyTest(machine, {
      adapter: randomAdapter({ seed: 3, numRuns: 40, maxCommands: 6 }),
      mode: 'executed',
      events: { START: constant({}) },
      commands: { advance: integer(400, 700) },
      invariant: ({ snapshot }) => {
        if ((snapshot as any).value === 'elapsed') {
          sawElapsed = true;
        }
      }
    });

    expect(sawElapsed).toBe(true);
    expect(coverage.stateNodes.covered).toContain('timer.elapsed');
    expect(coverage.clockAdvances).toBeGreaterThan(0);
  });

  it('records child actor transitions in the timeline', async () => {
    const machine = fetchMachine();
    const error = await propertyTest(machine, {
      adapter: randomAdapter({ seed: 1, numRuns: 5, maxCommands: 3 }),
      mode: 'executed',
      actors: { fetcher: createAsyncLogic({ run: async () => 42 }) },
      events: { FETCH: constant({}) },
      invariant: ({ snapshot }) => {
        if ((snapshot as any).value === 'success') {
          throw new Error('reached success');
        }
      }
    }).catch((cause) => cause as PropertyTestFailure);

    expect(error).toBeInstanceOf(PropertyTestFailure);
    const kinds = (error as PropertyTestFailure).trace.timeline.map(
      (entry) => entry.kind
    );
    expect(kinds).toContain('actorEvent');
    const actorEntries = (error as PropertyTestFailure).trace.timeline.filter(
      (entry) => entry.kind === 'actorEvent'
    );
    expect(
      actorEntries.some((entry) => (entry as any).source === 'child')
    ).toBe(true);
  });

  it('replays an executed failure against stubbed actors', async () => {
    const machine = fetchMachine();
    let realCalls = 0;
    const real = createAsyncLogic({
      run: async () => {
        realCalls++;
        return 42;
      }
    });

    const failure = (await propertyTest(machine, {
      adapter: randomAdapter({ seed: 5, numRuns: 5, maxCommands: 3 }),
      mode: 'executed',
      actors: { fetcher: real },
      events: { FETCH: constant({}) },
      invariant: ({ snapshot }) => {
        if ((snapshot as any).value === 'success') {
          throw new Error('reached success');
        }
      }
    }).catch((cause) => cause)) as PropertyTestFailure;

    expect(failure).toBeInstanceOf(PropertyTestFailure);
    const fixture = failure.fixture as PortablePropertyReplayFixture;
    expect(fixture.mode).toBe('executed');
    expect(fixture.outcomes).toEqual([
      { src: 'fetcher', occurrence: 0, outcome: { ok: true, output: 42 } }
    ]);

    realCalls = 0;
    // No `actors` are provided: the recorded outcomes drive stub actors.
    const replayError = await replayPropertyTest(machine, fixture, {
      invariant: ({ snapshot }) => {
        if ((snapshot as any).value === 'success') {
          throw new Error('reached success');
        }
      }
    }).catch((cause) => cause as Error);

    expect(replayError).toBeInstanceOf(PropertyTestFailure);
    expect(realCalls).toBe(0);
  });

  it('produces the same trace twice for one seed', async () => {
    const run = async () => {
      const traces: string[] = [];
      await propertyTest(fetchMachine(), {
        adapter: randomAdapter({ seed: 11, numRuns: 10, maxCommands: 4 }),
        mode: 'executed',
        outcomes: {
          fetcher: oneOf<any>(
            { ok: true, output: 1 },
            { ok: false, error: 'bad' }
          )
        },
        events: { FETCH: constant({}) },
        invariant: ({ snapshot, step }) => {
          traces.push(`${step}:${JSON.stringify((snapshot as any).value)}`);
        }
      });
      return traces.join('|');
    };

    expect(await run()).toBe(await run());
  });

  it('rejects actors and outcomes in pure mode', async () => {
    await expect(
      propertyTest(fetchMachine(), {
        adapter: randomAdapter({ seed: 1, numRuns: 1 }),
        outcomes: { fetcher: constant({ ok: true, output: 1 } as any) },
        events: { FETCH: constant({}) },
        invariant: () => {}
      })
    ).rejects.toThrow("require `mode: 'executed'`");
  });

  it('reports pure as the default exploration mode', async () => {
    const machine = createMachine({
      id: 'plain',
      initial: 'idle',
      schemas: { events: { FETCH: types<{}>() } },
      states: { idle: { on: { FETCH: { target: 'done' } } }, done: {} }
    });
    const { coverage } = await propertyTest(machine, {
      adapter: randomAdapter({ seed: 1, numRuns: 2, maxCommands: 2 }),
      events: { FETCH: record({}) },
      invariant: () => {}
    });
    expect(coverage.exploration.mode).toBe('pure');
  });
});
