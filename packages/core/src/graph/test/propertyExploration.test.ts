import { createMachine, types } from '../../index.ts';
import {
  formatPropertyCoverage,
  propertyCoverageToJSON,
  propertyTest,
  type PropertyCoverage
} from '../index.ts';
import { constant, randomAdapter } from './propertyTestAdapter.ts';

const ringMachine = createMachine({
  id: 'ring',
  initial: 'a',
  states: {
    a: { on: { NEXT: { target: 'b' } } },
    b: { on: { NEXT: { target: 'c' } } },
    c: { on: { NEXT: { target: 'a' } } }
  }
});

const deepMachine = createMachine({
  id: 'deep',
  initial: 's0',
  states: {
    s0: { on: { GO: { target: 's1' } } },
    s1: { on: { GO: { target: 's2' } } },
    s2: { on: { GO: { target: 's3' } } },
    s3: { on: { GO: { target: 's4' } } },
    s4: { on: { GO: { target: 's5' } } },
    s5: { on: { DEEP: { target: 'done' } } },
    done: {}
  }
});

const labelMachine = createMachine({
  id: 'labels',
  schemas: {
    context: types<{ count: number }>(),
    events: { INC: types<{}>() }
  },
  context: { count: 0 },
  on: {
    INC: ({ context }) => ({ context: { count: context.count + 1 } })
  }
});

const noop = () => {};

function transitionRatio(coverage: PropertyCoverage): number {
  const { covered, uncovered } = coverage.transitions;
  return covered.length / (covered.length + uncovered.length);
}

describe('property stop conditions', () => {
  it('runs a single campaign when `until` is absent', async () => {
    const { coverage } = await propertyTest(ringMachine, {
      adapter: randomAdapter({ seed: 1, numRuns: 8, maxCommands: 4 }),
      events: { NEXT: constant({}) },
      invariant: noop
    });

    expect(coverage.exploration.configuredRuns).toBe(8);
    expect(coverage.exploration.completedRuns).toBe(8);
    expect(coverage.exploration.stoppedBecause).toBe('budget');
  });

  it('stops early once the transition ratio is reached', async () => {
    const { coverage } = await propertyTest(ringMachine, {
      adapter: randomAdapter({ seed: 1, maxCommands: 6 }),
      events: { NEXT: constant({}) },
      invariant: noop,
      until: { transitions: 1 },
      batchRuns: 5,
      maxRuns: 200
    });

    expect(transitionRatio(coverage)).toBe(1);
    expect(coverage.exploration.stoppedBecause).toBe('until');
    expect(coverage.exploration.completedRuns).toBeLessThan(
      coverage.exploration.configuredRuns!
    );
    expect(coverage.exploration.completedRuns).toBe(5);
  });

  it('accepts a predicate stop condition', async () => {
    const seen: number[] = [];
    const { coverage } = await propertyTest(ringMachine, {
      adapter: randomAdapter({ seed: 3, maxCommands: 2 }),
      events: { NEXT: constant({}) },
      invariant: noop,
      until: (current) => {
        seen.push(current.exploration.completedRuns);
        return current.exploration.completedRuns >= 10;
      },
      batchRuns: 5,
      maxRuns: 100
    });

    expect(seen).toEqual([5, 10]);
    expect(coverage.exploration.completedRuns).toBe(10);
    expect(coverage.exploration.stoppedBecause).toBe('until');
  });

  it('stops on the budget when the condition is never met', async () => {
    const { coverage } = await propertyTest(ringMachine, {
      adapter: randomAdapter({ seed: 4, maxCommands: 1 }),
      events: { NEXT: constant({}) },
      invariant: noop,
      until: { runs: 1000 },
      batchRuns: 4,
      maxRuns: 8
    });

    expect(coverage.exploration.completedRuns).toBe(8);
    expect(coverage.exploration.stoppedBecause).toBe('budget');
  });

  it('ORs the conditions listed under `any`', async () => {
    const { coverage } = await propertyTest(ringMachine, {
      adapter: randomAdapter({ seed: 5, maxCommands: 1 }),
      events: { NEXT: constant({}) },
      invariant: noop,
      until: { any: [{ transitions: 1 }, { runs: 4 }] },
      batchRuns: 4,
      maxRuns: 40
    });

    expect(coverage.exploration.completedRuns).toBe(4);
    expect(coverage.exploration.stoppedBecause).toBe('until');
  });
});

describe('coverage-guided exploration', () => {
  it('reaches a deep branch that random exploration cannot', async () => {
    const shared = {
      events: { GO: constant({}), DEEP: constant({}) },
      invariant: noop,
      maxRuns: 20,
      batchRuns: 5
    } as const;

    const random = await propertyTest(deepMachine, {
      adapter: randomAdapter({ seed: 11, maxCommands: 4 }),
      ...shared,
      until: { transitions: 1 }
    });
    const guided = await propertyTest(deepMachine, {
      adapter: randomAdapter({ seed: 11, maxCommands: 4 }),
      ...shared,
      frontiers: 'auto',
      until: { transitions: 1 }
    });

    // Four generated commands can never walk the five-step chain.
    expect(random.coverage.stateNodes.covered).not.toContain('deep.s5');
    expect(guided.coverage.stateNodes.covered).toContain('deep.s5');
    expect(guided.coverage.stateNodes.covered).toContain('deep.done');
    expect(transitionRatio(guided.coverage)).toBeGreaterThan(
      transitionRatio(random.coverage)
    );
    expect(guided.coverage.exploration.frontiers.length).toBeGreaterThan(1);
  });

  it('accepts the explicit `uncovered` strategy and reports frontiers', async () => {
    const { coverage } = await propertyTest(deepMachine, {
      adapter: randomAdapter({ seed: 2, maxCommands: 3 }),
      events: { GO: constant({}), DEEP: constant({}) },
      invariant: noop,
      frontiers: { strategy: 'uncovered', maxFrontiers: 3, runsPerFrontier: 2 },
      until: { transitions: 1 },
      batchRuns: 6,
      maxRuns: 30
    });

    expect(coverage.frontiers.covered.length).toBeGreaterThan(0);
    for (const frontier of coverage.exploration.frontiers) {
      expect(frontier.runBudget).toBe(2);
    }
  });

  it('falls back to random exploration when nothing is uncovered', async () => {
    const { coverage } = await propertyTest(ringMachine, {
      adapter: randomAdapter({ seed: 6, maxCommands: 6 }),
      events: { NEXT: constant({}) },
      invariant: noop,
      frontiers: 'auto',
      batchRuns: 4,
      maxRuns: 8
    });

    expect(coverage.exploration.completedRuns).toBe(8);
    expect(coverage.exploration.stoppedBecause).toBe('budget');
  });
});

describe('labels and statistics', () => {
  it('aggregates label counts, values and shares', async () => {
    const { coverage } = await propertyTest(labelMachine, {
      adapter: randomAdapter({ seed: 9, numRuns: 4, maxCommands: 3 }),
      events: { INC: constant({}) },
      invariant: ({ snapshot, label, classify }) => {
        label('count', snapshot.context.count);
        classify(snapshot.context.count === 0, 'initial');
      }
    });

    expect(coverage.labels.count.count).toBe(coverage.invariantChecks);
    expect(coverage.labels.count.values['0']).toBe(4);
    expect(coverage.labels.initial.count).toBe(4);
    expect(coverage.labels.initial.share).toBe(1);
    expect(coverage.labels.count.share).toBe(1);
  });

  it('renders labels in text, markdown and JSON', async () => {
    const { coverage } = await propertyTest(labelMachine, {
      adapter: randomAdapter({ seed: 9, numRuns: 2, maxCommands: 2 }),
      events: { INC: constant({}) },
      invariant: ({ snapshot, label }) => {
        label('count', snapshot.context.count);
      }
    });

    expect(formatPropertyCoverage(coverage)).toContain('labels:');
    expect(formatPropertyCoverage(coverage, { format: 'markdown' })).toContain(
      '## Labels'
    );
    expect(propertyCoverageToJSON(coverage).labels.count.count).toBe(
      coverage.labels.count.count
    );
  });

  it('fails the campaign when `expectLabels` is not met', async () => {
    const error = await propertyTest(labelMachine, {
      adapter: randomAdapter({ seed: 9, numRuns: 3, maxCommands: 2 }),
      events: { INC: constant({}) },
      invariant: ({ snapshot, classify }) => {
        classify(snapshot.context.count > 100, 'large');
      },
      expectLabels: { large: { min: 0.5, minCount: 1 } }
    }).then(
      () => undefined,
      (cause: unknown) => cause as Error & { coverage: PropertyCoverage }
    );

    expect(error).toBeInstanceOf(Error);
    expect(error!.message).toContain('large: share 0.000 is below 0.5');
    expect(error!.message).toContain('large: count 0 is below 1');
    expect(error!.coverage.runs).toBe(3);
  });

  it('passes when `expectLabels` is met', async () => {
    await expect(
      propertyTest(labelMachine, {
        adapter: randomAdapter({ seed: 9, numRuns: 3, maxCommands: 2 }),
        events: { INC: constant({}) },
        invariant: ({ classify }) => {
          classify(true, 'always');
        },
        expectLabels: { always: { min: 1, minCount: 3 } }
      })
    ).resolves.toBeDefined();
  });
});
