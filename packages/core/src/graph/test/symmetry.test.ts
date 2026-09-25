import { createMachine, types } from '../../index.ts';
import {
  ModelTestFailure,
  propertyTest,
  replayTest,
  testPaths,
  type TestCoverage,
  type TestSut
} from '../index.ts';
import { constant, randomAdapter, record } from './propertyTestAdapter.ts';

/**
 * The same machine, the same `sut`, and the same oracles run through both
 * entry points. Only the generation strategy differs.
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
          context: {
            count: Math.min(3, context.count + event.value)
          }
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
  INC: record({ value: constant(1) }),
  RESET: constant({})
};

interface Recorder {
  stateCalls: string[];
  metaCalls: string[];
}

/**
 * An in-memory system under test. With `bugAt`, it stops counting once it
 * reaches that value, so the model and the SUT diverge.
 */
function createSut(recorder: Recorder, bugAt?: number): TestSut<any, any> {
  return {
    projectModel: (snapshot: any) => snapshot.context.count,
    create: () => {
      let count = 0;
      const session = {
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
      return session;
    }
  };
}

function dimensionUniverse(coverage: TestCoverage, key: 'transitions') {
  return [
    ...coverage[key].covered,
    ...coverage[key].uncovered,
    ...coverage[key].unreachable,
    ...coverage[key].unknown
  ].sort();
}

describe('path and property symmetry', () => {
  it('produces the same coverage shape from both strategies', async () => {
    const pathRecorder: Recorder = { stateCalls: [], metaCalls: [] };
    const propertyRecorder: Recorder = { stateCalls: [], metaCalls: [] };

    const pathRun = await testPaths(counterMachine, {
      events,
      sut: createSut(pathRecorder),
      invariant: ({ snapshot }) => {
        expect(snapshot.context.count).toBeGreaterThanOrEqual(0);
      }
    });
    const propertyRun = await propertyTest(counterMachine, {
      adapter: randomAdapter({ seed: 5, numRuns: 20, maxCommands: 5 }),
      events,
      sut: createSut(propertyRecorder),
      invariant: ({ snapshot }) => {
        expect(snapshot.context.count).toBeGreaterThanOrEqual(0);
      }
    });

    expect(Object.keys(pathRun.coverage).sort()).toEqual(
      Object.keys(propertyRun.coverage).sort()
    );
    expect(dimensionUniverse(pathRun.coverage, 'transitions')).toEqual(
      dimensionUniverse(propertyRun.coverage, 'transitions')
    );
    // Paths only reach a subset of the universe, never something outside it.
    for (const id of pathRun.coverage.transitions.covered) {
      expect(dimensionUniverse(propertyRun.coverage, 'transitions')).toContain(
        id
      );
    }

    expect(pathRun.coverage.exploration.strategy).toBe('paths');
    expect(pathRun.coverage.exploration.pathGenerator).toBe('shortest');
    expect(pathRun.coverage.exploration.pathCount).toBe(pathRun.results.length);
    expect(propertyRun.coverage.exploration.strategy).toBe('property');

    // `states` and `meta.test` fire on both sides.
    expect(pathRecorder.stateCalls.length).toBeGreaterThan(0);
    expect(pathRecorder.metaCalls.length).toBeGreaterThan(0);
    expect(propertyRecorder.stateCalls.length).toBeGreaterThan(0);
    expect(propertyRecorder.metaCalls.length).toBeGreaterThan(0);
  });

  it('fails the same way and replays from either fixture', async () => {
    const recorder: Recorder = { stateCalls: [], metaCalls: [] };

    const pathFailure = (await testPaths(counterMachine, {
      events,
      samples: 1,
      sut: createSut(recorder, 1)
    }).catch((error) => error)) as ModelTestFailure;
    const propertyFailure = (await propertyTest(counterMachine, {
      adapter: randomAdapter({ seed: 11, numRuns: 50, maxCommands: 6 }),
      events,
      sut: createSut(recorder, 1)
    }).catch((error) => error)) as ModelTestFailure;

    for (const failure of [pathFailure, propertyFailure]) {
      expect(failure).toBeInstanceOf(ModelTestFailure);
      expect(failure.trace).toBeDefined();
      expect(failure.fixture).toBeDefined();
      expect(failure.coverage).toBeDefined();
    }
    expect(pathFailure.coverage!.exploration.strategy).toBe('paths');
    expect(propertyFailure.coverage!.exploration.strategy).toBe('property');

    for (const failure of [pathFailure, propertyFailure]) {
      await expect(
        replayTest(counterMachine, failure.fixture!, {
          sut: createSut({ stateCalls: [], metaCalls: [] }, 1)
        })
      ).rejects.toBeInstanceOf(ModelTestFailure);
    }
  });
});
