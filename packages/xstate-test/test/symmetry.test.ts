import * as fc from 'fast-check';
import { createAsyncLogic, createMachine, types } from 'xstate';
import {
  ModelTestFailure,
  propertyTest,
  replayTest,
  testPaths,
  type TestCoverage,
  type TestSut
} from '../src/index.ts';

/**
 * One machine, one `sut`, one oracle set, two generation strategies.
 */
const counterMachine = createMachine({
  id: 'counter',
  schemas: {
    context: types<{ count: number }>(),
    meta: types<{ test: (session: any) => void }>(),
    events: {
      INC: types<{ value: number }>(),
      RESET: types<{}>()
    }
  },
  context: { count: 0 },
  initial: 'counting',
  states: {
    counting: {
      meta: {
        test: (session: any) => {
          session?.metaCalls?.push('counting');
        }
      },
      on: {
        // Bounded so graph traversal terminates.
        INC: ({ context, event }) => ({
          context: { count: Math.min(3, context.count + event.value) }
        }),
        RESET: { target: 'done' }
      }
    },
    done: {
      meta: {
        test: (session: any) => {
          session?.metaCalls?.push('done');
        }
      },
      type: 'final'
    }
  }
});

const events = {
  INC: fc.record({ value: fc.constant(1) }),
  RESET: fc.constant({})
};

interface Recorder {
  stateCalls: string[];
  metaCalls: string[];
}

function createSut(recorder: Recorder, bugAt?: number): TestSut<any, any> {
  return {
    projectModel: (snapshot: any) => snapshot.context.count,
    create: () => {
      let count = 0;
      return {
        metaCalls: recorder.metaCalls,
        send: (event: any) => {
          if (event.type === 'INC') {
            if (bugAt !== undefined && count >= bugAt) {
              return;
            }
            count = Math.min(3, count + event.value);
          }
        },
        read: () => count,
        states: {
          '*': (snapshot: any) => {
            recorder.stateCalls.push(String(snapshot.value));
          }
        }
      };
    }
  };
}

function transitionUniverse(coverage: TestCoverage) {
  return [
    ...coverage.transitions.covered,
    ...coverage.transitions.uncovered,
    ...coverage.transitions.unreachable,
    ...coverage.transitions.unknown
  ].sort();
}

describe('testPaths / propertyTest symmetry', () => {
  it('produces the same coverage shape from both strategies', async () => {
    const pathRecorder: Recorder = { stateCalls: [], metaCalls: [] };
    const propertyRecorder: Recorder = { stateCalls: [], metaCalls: [] };
    const invariant = ({ snapshot }: any) => {
      expect(snapshot.context.count).toBeLessThanOrEqual(3);
    };

    const pathRun = await testPaths(counterMachine, {
      events,
      sut: createSut(pathRecorder),
      invariant
    });
    const propertyRun = await propertyTest(counterMachine, {
      seed: 4,
      numRuns: 20,
      maxCommands: 5,
      events,
      sut: createSut(propertyRecorder),
      invariant
    });

    expect(Object.keys(pathRun.coverage).sort()).toEqual(
      Object.keys(propertyRun.coverage).sort()
    );
    expect(transitionUniverse(pathRun.coverage)).toEqual(
      transitionUniverse(propertyRun.coverage)
    );
    for (const id of pathRun.coverage.transitions.covered) {
      expect(transitionUniverse(propertyRun.coverage)).toContain(id);
    }

    expect(pathRun.coverage.exploration.strategy).toBe('paths');
    expect(pathRun.coverage.exploration.pathGenerator).toBe('shortest');
    expect(pathRun.coverage.exploration.pathCount).toBe(pathRun.results.length);
    expect(propertyRun.coverage.exploration.strategy).toBe('property');

    for (const recorder of [pathRecorder, propertyRecorder]) {
      expect(recorder.stateCalls.length).toBeGreaterThan(0);
      expect(recorder.metaCalls.length).toBeGreaterThan(0);
    }
  });

  it('fails the same way and replays from either fixture', async () => {
    const recorder: Recorder = { stateCalls: [], metaCalls: [] };

    const pathFailure = (await testPaths(counterMachine, {
      events,
      samples: 1,
      sut: createSut(recorder, 1)
    }).catch((error) => error)) as ModelTestFailure;
    const propertyFailure = (await propertyTest(counterMachine, {
      seed: 9,
      numRuns: 50,
      maxCommands: 6,
      events,
      sut: createSut(recorder, 1)
    }).catch((error) => error)) as ModelTestFailure;

    for (const failure of [pathFailure, propertyFailure]) {
      expect(failure).toBeInstanceOf(ModelTestFailure);
      expect(failure.trace).toBeDefined();
      expect(failure.fixture).toBeDefined();
      expect(failure.coverage).toBeDefined();
      await expect(
        replayTest(counterMachine, failure.fixture!, {
          sut: createSut({ stateCalls: [], metaCalls: [] }, 1)
        })
      ).rejects.toBeInstanceOf(ModelTestFailure);
    }
  });
});

/**
 * Invoked actors and a delayed transition: the branches that only exist once a
 * real actor runs. Both entry points reach them in executed mode — one by
 * generating `outcome` and `advance` commands, the other by translating the
 * internal events its paths went through into the same commands.
 */
const fetchMachine = createMachine({
  id: 'fetch',
  schemas: {
    context: types<{ data: unknown; error: string | null }>(),
    events: { FETCH: types<{}>() }
  },
  actors: {
    fetchUser: createAsyncLogic({
      run: async () => {
        throw new Error('the real `fetchUser` actor ran');
      }
    })
  },
  context: { data: null, error: null },
  initial: 'idle',
  states: {
    idle: { on: { FETCH: { target: 'loading' } } },
    loading: {
      invoke: {
        src: 'fetchUser',
        onDone: ({ context, event }) => ({
          target: 'success',
          context: { ...context, data: event.output }
        }),
        onError: ({ context, event }) => ({
          target: 'failure',
          context: { ...context, error: String(event.error) }
        })
      }
    },
    success: { after: { 1000: { target: 'idle' } } },
    failure: { on: { FETCH: { target: 'loading' } } }
  }
});

const fetchOutcomes = {
  fetchUser: fc.oneof(
    fc.constant({ ok: true, output: { id: 1 } }),
    fc.constant({ ok: false, error: new Error('offline') })
  )
};

describe('executed-mode symmetry', () => {
  it('leaves the same transitions uncovered from both strategies', async () => {
    const pathRun = await testPaths(fetchMachine, {
      mode: 'executed',
      samples: 1,
      seed: 7,
      events: { FETCH: fc.constant({}) },
      outcomes: fetchOutcomes
    });
    const propertyRun = await propertyTest(fetchMachine, {
      mode: 'executed',
      seed: 7,
      numRuns: 60,
      maxCommands: 8,
      events: { FETCH: fc.constant({}) },
      outcomes: fetchOutcomes,
      commands: { advance: fc.constant(1000) }
    });

    expect(transitionUniverse(pathRun.coverage)).toEqual(
      transitionUniverse(propertyRun.coverage)
    );
    expect(pathRun.coverage.transitions.uncovered).toEqual(
      propertyRun.coverage.transitions.uncovered
    );
    expect(pathRun.coverage.transitions.uncovered).toEqual([]);
    expect(pathRun.coverage.exploration.strategy).toBe('paths');
    expect(propertyRun.coverage.exploration.strategy).toBe('property');
  });
});
