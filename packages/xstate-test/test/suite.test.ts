import * as fc from 'fast-check';
import { createMachine } from 'xstate';
import {
  describeTestSuite,
  fastCheckAdapter,
  generateTestSuite,
  parseTestSuite,
  replayTestSuite,
  serializeTestSuite
} from '../src/index.ts';

const trafficMachine = createMachine({
  id: 'traffic',
  initial: 'red',
  states: {
    red: { on: { NEXT: { target: 'green' }, STOP: { target: 'red' } } },
    green: { on: { NEXT: { target: 'yellow' }, STOP: { target: 'red' } } },
    yellow: { on: { NEXT: { target: 'red' }, STOP: { target: 'red' } } }
  }
});

/** `STOP` always parks the light on red. */
const invariant = ({ snapshot, event }: { snapshot: any; event: any }) => {
  expect(typeof snapshot.value).toBe('string');
  if (event?.type === 'STOP') {
    expect(snapshot.value).toBe('red');
  }
};

const generate = () =>
  generateTestSuite(trafficMachine, {
    numRuns: 25,
    seed: 3,
    events: {
      NEXT: fc.constant({}),
      STOP: fc.constant({})
    },
    invariant
  });

describe('property suites with FastCheck', () => {
  it('exports a coverage-complete suite that replays offline', async () => {
    const suite = await generate();

    expect(suite.machineId).toBe('traffic');
    expect(suite.coverage.dimensions.transitions.uncovered).toEqual([]);
    expect(suite.fixtures.length).toBeGreaterThan(0);

    const replayed = parseTestSuite(serializeTestSuite(suite));
    const result = await replayTestSuite(trafficMachine, replayed, {
      invariant
    });

    expect(result.failed).toEqual([]);
    expect(result.passed).toBe(suite.fixtures.length);
  });

  it('registers one test per fixture', async () => {
    const suite = await generate();
    const registered: string[] = [];

    describeTestSuite(suite, trafficMachine, {
      invariant,
      describe: (_name, fn) => fn(),
      it: (name) => {
        registered.push(name);
      }
    });

    expect(registered).toHaveLength(suite.fixtures.length);
  });
});
