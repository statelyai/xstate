import { createMachine, types } from '../../index.ts';
import * as graph from '../index.ts';
import { testPaths, fromTestParam } from '../testPaths.ts';
import type { Step } from '../types.ts';

/** Every deprecated value alias and the export it must be identical to. */
const DEPRECATED_VALUE_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ['PropertyTestFailure', 'ModelTestFailure'],
  ['PropertyReplayNotReproducedError', 'ReplayNotReproducedError'],
  ['formatPropertyTrace', 'formatTestTrace'],
  ['serializePropertyTrace', 'serializeTestTrace'],
  ['replayPropertyTest', 'replayTest'],
  ['assertPropertyCoverage', 'assertTestCoverage'],
  ['formatPropertyCoverage', 'formatTestCoverage'],
  ['formatPropertyCoverageHTML', 'formatTestCoverageHTML'],
  ['formatPropertyCoverageJUnit', 'formatTestCoverageJUnit'],
  ['formatPropertyCoverageId', 'formatTestCoverageId'],
  ['propertyCoverageToJSON', 'testCoverageToJSON'],
  ['describePropertySuite', 'describeTestSuite'],
  ['generatePropertySuite', 'generateTestSuite'],
  ['replayPropertySuite', 'replayTestSuite'],
  ['replayPropertySuiteFixture', 'replayTestSuiteFixture'],
  ['serializePropertySuite', 'serializeTestSuite'],
  ['parsePropertySuite', 'parseTestSuite'],
  ['formatPropertySuiteFixtureTitle', 'formatTestSuiteFixtureTitle']
];

describe('deprecated aliases', () => {
  it.each(DEPRECATED_VALUE_ALIASES)('`%s` is `%s`', (alias, target) => {
    const exports = graph as unknown as Record<string, unknown>;
    expect(exports[alias]).toBeDefined();
    expect(exports[alias]).toBe(exports[target]);
  });
});

const toggleMachine = createMachine({
  id: 'toggle',
  initial: 'off',
  schemas: { events: { TOGGLE: types<{}>() } },
  states: {
    off: { on: { TOGGLE: { target: 'on' } } },
    on: { on: { TOGGLE: { target: 'off' } } }
  }
});

describe('testPaths option validation', () => {
  it('rejects `outcomes`', async () => {
    await expect(
      testPaths(toggleMachine, {
        mode: 'executed',
        outcomes: { fetcher: () => ({ type: 'done', output: 1 }) }
      } as never)
    ).rejects.toThrow(/not supported by path generation/);
  });

  it('rejects `commands`', async () => {
    await expect(
      testPaths(toggleMachine, { commands: { advance: () => 1 } } as never)
    ).rejects.toThrow(/not supported by path generation/);
  });

  it.each([0, -1, 1.5, Number.NaN])(
    'rejects `samples: %s`',
    async (samples) => {
      await expect(testPaths(toggleMachine, { samples })).rejects.toThrow(
        /`samples` must be an integer of at least 1/
      );
    }
  );
});

describe('testPaths event types', () => {
  it('offers declared event types a wildcard handler accepts', async () => {
    const seen: string[] = [];
    const wildcardMachine = createMachine({
      id: 'wildcard',
      initial: 'idle',
      schemas: { events: { ANYTHING: types<{}>() } },
      states: {
        idle: { on: { '*': { target: 'done' } } },
        done: {}
      }
    });

    await testPaths(wildcardMachine, {
      events: { ANYTHING: () => ({}) },
      sut: {
        create: () => ({
          send: (event) => {
            seen.push(event.type);
          }
        })
      }
    });

    expect(seen).toContain('ANYTHING');
  });
});

describe('legacy `TestParam` detection', () => {
  it('rejects pre-2.0 event executors passed as generators', async () => {
    await expect(
      testPaths(toggleMachine, {
        events: {
          // A pre-2.0 executor: it performs an effect and returns nothing
          // useful, so it must not be mistaken for a payload generator.
          TOGGLE: (() => 'performed') as never
        }
      })
    ).rejects.toThrow(/pre-2\.0 event executor/);
  });

  it('rejects the `{ events, states }` shape passed to `path.test()`', async () => {
    const model = graph.createTestModel(toggleMachine);
    const [path] = model.getShortestPaths();
    await expect(
      path.test({
        events: { TOGGLE: () => {} },
        states: { off: () => {} }
      } as never)
    ).rejects.toThrow(/pre-2\.0 event executor/);
  });
});

describe('fromTestParam', () => {
  it('passes the source snapshot as `step.state`', async () => {
    const states: unknown[] = [];
    await testPaths(toggleMachine, {
      sut: fromTestParam({
        events: {
          TOGGLE: (step: Step<any, any>) => {
            states.push((step.state as any).value);
          }
        }
      })
    });

    // Every step starts from `off` or `on`; the *source* of the first step is
    // always `off`, whereas the resulting snapshot would be `on`.
    expect(states[0]).toBe('off');
  });
});

describe('per-case seeding', () => {
  async function sampledPayloads(
    events: Record<string, unknown>
  ): Promise<unknown[]> {
    const payloads: unknown[] = [];
    const machine = createMachine({
      id: 'payloads',
      initial: 'idle',
      schemas: { events: { A: types<{ n: number }>(), B: types<{}>() } },
      states: { idle: { on: { A: { target: 'idle' }, B: { target: 'idle' } } } }
    });
    await testPaths(machine, {
      pathGenerator: 'simple',
      limit: 20,
      events: events as never,
      sut: {
        create: () => ({
          send: (event: any) => {
            if (event.type === 'A') {
              payloads.push(event.n);
            }
          }
        })
      }
    });
    return payloads;
  }

  it('does not shift a case when another event type is added', async () => {
    let counter = 0;
    const a = () => ({ n: counter++ });
    const before = await sampledPayloads({ A: a });
    counter = 0;
    const after = await sampledPayloads({ B: () => ({}), A: a });
    expect(after).toEqual(before);
  });
});

describe('allowDuplicatePaths', () => {
  it('deduplicates paths from a custom path generator', async () => {
    const generator: any = (logic: any, options: any) =>
      graph.getSimplePaths(logic, options);

    const deduplicated = await testPaths(toggleMachine, {
      pathGenerator: generator
    });
    const all = await testPaths(toggleMachine, {
      pathGenerator: generator,
      allowDuplicatePaths: true
    });

    expect(deduplicated.results.length).toBeLessThan(all.results.length);
  });
});
