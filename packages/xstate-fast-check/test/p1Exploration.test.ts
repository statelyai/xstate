import * as fc from 'fast-check';
import { createMachine, types } from 'xstate';
import { PropertyTestFailure, propertyTest } from 'xstate/graph';
import type { PropertyCoverage } from 'xstate/graph';
import { fastCheckAdapter } from '../src/index.ts';

const ringMachine = createMachine({
  id: 'exploration-ring',
  schemas: { events: { NEXT: types<{}>() } },
  initial: 'a',
  states: {
    a: { on: { NEXT: { target: 'b' } } },
    b: { on: { NEXT: { target: 'c' } } },
    c: { on: { NEXT: { target: 'a' } } }
  }
});

const deepMachine = createMachine({
  id: 'exploration-deep',
  schemas: { events: { GO: types<{}>(), DEEP: types<{}>() } },
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

const counterMachine = createMachine({
  id: 'exploration-counter',
  schemas: {
    context: types<{ count: number }>(),
    events: { INC: types<{}>() }
  },
  context: { count: 0 },
  on: {
    INC: ({ context }) => ({ context: { count: context.count + 1 } })
  }
});

function transitionRatio(coverage: PropertyCoverage): number {
  const { covered, uncovered } = coverage.transitions;
  return covered.length / (covered.length + uncovered.length);
}

describe('stop conditions', () => {
  it('stops as soon as every transition is covered', async () => {
    const { coverage } = await propertyTest(ringMachine, {
      adapter: fastCheckAdapter({ seed: 7, maxCommands: 6 }),
      events: { NEXT: fc.constant({}) },
      invariant: () => {},
      until: { transitions: 1 },
      batchRuns: 5,
      maxRuns: 500
    });

    expect(transitionRatio(coverage)).toBe(1);
    expect(coverage.exploration.stoppedBecause).toBe('until');
    expect(coverage.exploration.configuredRuns).toBe(500);
    expect(coverage.exploration.completedRuns).toBeLessThan(500);
  });

  it('stops on a predicate', async () => {
    const { coverage } = await propertyTest(ringMachine, {
      adapter: fastCheckAdapter({ seed: 7, maxCommands: 2 }),
      events: { NEXT: fc.constant({}) },
      invariant: () => {},
      until: (current) =>
        current.stateNodes.covered.includes('exploration-ring.c'),
      batchRuns: 3,
      maxRuns: 60
    });

    expect(coverage.stateNodes.covered).toContain('exploration-ring.c');
    expect(coverage.exploration.stoppedBecause).toBe('until');
  });

  it('keeps the single-campaign behavior when `until` is absent', async () => {
    const { coverage } = await propertyTest(ringMachine, {
      adapter: fastCheckAdapter({ seed: 7, numRuns: 12, maxCommands: 3 }),
      events: { NEXT: fc.constant({}) },
      invariant: () => {}
    });

    expect(coverage.exploration.configuredRuns).toBe(12);
    expect(coverage.exploration.completedRuns).toBe(12);
    expect(coverage.exploration.stoppedBecause).toBe('budget');
  });
});

describe('coverage-guided frontiers', () => {
  it('covers a deep branch that unguided runs miss', async () => {
    const guided = await propertyTest(deepMachine, {
      adapter: fastCheckAdapter({ seed: 21, maxCommands: 4 }),
      events: { GO: fc.constant({}), DEEP: fc.constant({}) },
      invariant: () => {},
      frontiers: 'auto',
      until: { transitions: 1 },
      batchRuns: 10,
      maxRuns: 40
    });
    const unguided = await propertyTest(deepMachine, {
      adapter: fastCheckAdapter({ seed: 21, maxCommands: 4 }),
      events: { GO: fc.constant({}), DEEP: fc.constant({}) },
      invariant: () => {},
      until: { transitions: 1 },
      batchRuns: 10,
      maxRuns: 40
    });

    expect(unguided.coverage.stateNodes.covered).not.toContain(
      'exploration-deep.s5'
    );
    expect(guided.coverage.stateNodes.covered).toContain('exploration-deep.s5');
    expect(transitionRatio(guided.coverage)).toBeGreaterThan(
      transitionRatio(unguided.coverage)
    );
  });

  it('shrinks only the generated continuation of a frontier', async () => {
    const failure = await propertyTest(deepMachine, {
      adapter: fastCheckAdapter({ seed: 3, maxCommands: 4 }),
      events: { GO: fc.constant({}), DEEP: fc.constant({}) },
      invariant: ({ snapshot }) => {
        if (snapshot.matches('done')) {
          throw new Error('reached done');
        }
      },
      frontiers: 'auto',
      until: { transitions: 1 },
      batchRuns: 10,
      maxRuns: 40
    }).then(
      () => undefined,
      (cause: unknown) => cause as PropertyTestFailure
    );

    expect(failure).toBeInstanceOf(PropertyTestFailure);
    // The prefix that walks the chain is replayed verbatim; shrinking only
    // removes generated commands, leaving the step that reaches `done`.
    const prefix = failure!.trace.prefixEvents;
    expect(prefix.length).toBeGreaterThan(0);
    expect(prefix.every((event) => event.type === 'GO')).toBe(true);
    expect(failure!.trace.events.at(-1)).toEqual({ type: 'DEEP' });
    expect(prefix.length + failure!.trace.events.length).toBe(6);
    expect(failure!.message).toContain('prefix/frontier');
  });
});

describe('labels', () => {
  it('records labels and enforces `expectLabels`', async () => {
    const { coverage } = await propertyTest(counterMachine, {
      adapter: fastCheckAdapter({ seed: 5, numRuns: 20, maxCommands: 4 }),
      events: { INC: fc.constant({}) },
      invariant: ({ snapshot, label, classify }) => {
        label('count', snapshot.context.count);
        classify(snapshot.context.count > 1, 'above one');
      },
      expectLabels: { count: { min: 1 } }
    });

    expect(coverage.labels.count.share).toBe(1);
    expect(coverage.labels.count.values['0']).toBe(20);
    expect(coverage.labels['above one'].count).toBeGreaterThan(0);
  });

  it('reports label shortfalls with the coverage attached', async () => {
    const error = await propertyTest(counterMachine, {
      adapter: fastCheckAdapter({ seed: 5, numRuns: 5, maxCommands: 2 }),
      events: { INC: fc.constant({}) },
      invariant: ({ snapshot, classify }) => {
        classify(snapshot.context.count > 50, 'huge');
      },
      expectLabels: { huge: { min: 0.25 } }
    }).then(
      () => undefined,
      (cause: unknown) => cause as Error & { coverage: PropertyCoverage }
    );

    expect(error!.name).toBe('PropertyLabelExpectationError');
    expect(error!.message).toContain('huge: share 0.000 is below 0.25');
    expect(error!.coverage.exploration.completedRuns).toBe(5);
  });
});
