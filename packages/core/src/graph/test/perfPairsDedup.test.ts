import { createMachine, type EventObject } from '../../index.ts';
import {
  createTestCoverage,
  finalizeTestCoverage,
  recordPropertyTransitions
} from '../coverage.ts';
import { deduplicatePaths } from '../deduplicatePaths.ts';
import type { StatePath } from '../types.ts';
import { simpleStringify } from '../utils.ts';

type AnyPath = StatePath<any, EventObject>;

/** The previous O(n^2 * L) implementation, kept as an oracle. */
function deduplicatePathsOracle(
  paths: AnyPath[],
  serializeEvent: (event: EventObject) => string = simpleStringify
): AnyPath[] {
  const all = paths.map((path) => ({
    path,
    eventSequence: path.steps.map((step) => serializeEvent(step.event))
  }));
  all.sort((a, z) => z.path.steps.length - a.path.steps.length);
  const superpaths: typeof all = [];
  pathLoop: for (const candidate of all) {
    superpathLoop: for (const superpath of superpaths) {
      for (let i = 0; i < candidate.eventSequence.length; i++) {
        if (candidate.eventSequence[i] !== superpath.eventSequence[i]) {
          continue superpathLoop;
        }
      }
      continue pathLoop;
    }
    superpaths.push(candidate);
  }
  return superpaths.map((entry) => entry.path);
}

function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state / 2 ** 31;
  };
}

function randomPaths(
  random: () => number,
  count: number,
  maxLength: number,
  alphabet: number
): AnyPath[] {
  return Array.from({ length: count }, (_, index) => ({
    state: { index } as any,
    weight: 0,
    steps: Array.from(
      { length: Math.floor(random() * (maxLength + 1)) },
      () => ({
        state: {} as any,
        event: { type: `E${Math.floor(random() * alphabet)}` }
      })
    )
  }));
}

function getPairUniverse(coverage: ReturnType<typeof createTestCoverage>) {
  return finalizeTestCoverage(coverage).transitionPairs;
}

describe('transition pair universe', () => {
  it('does not declare pairs involving dynamic transitions', () => {
    const machine = createMachine({
      id: 'dyn',
      initial: 'a',
      context: { next: 'b' as 'a' | 'b' },
      states: {
        a: {
          on: {
            GO: { target: 'b' },
            JUMP: ({ context }) => ({ target: context.next })
          }
        },
        b: {
          on: { BACK: { target: 'a' } }
        }
      }
    });

    const coverage = createTestCoverage(machine);
    const pairs = getPairUniverse(coverage);
    const declared = [...coverage.transitionPairs.declarations.keys()];
    const jump = Object.keys(coverage.dynamicTransitions)[0];

    expect(jump).toBeDefined();
    expect(declared.length).toBeGreaterThan(0);
    expect(declared.some((id) => id.includes(jump))).toBe(false);
    expect(pairs.unknown).toEqual([]);
    expect(pairs.truncated).toBe(false);
    // a -GO-> b -BACK-> a -GO-> b: every static ordering is declared.
    expect(declared).toHaveLength(2);

    // Observed pairs involving the dynamic transition still count as covered.
    const a = machine.root.states.a;
    recordPropertyTransitions(coverage, { type: 'GO' }, [
      a.transitions.get('GO')![0]
    ]);
    recordPropertyTransitions(coverage, { type: 'JUMP' }, [
      a.transitions.get('JUMP')![0]
    ]);
    const observed = getPairUniverse(coverage);
    expect(observed.covered).toHaveLength(1);
    expect(observed.covered[0]).toContain(jump);
    expect(observed.unknown).toEqual([]);
  });

  it('caps the declared universe and reports truncation', () => {
    const size = 60;
    const states: Record<string, { on: Record<string, { target: string }> }> =
      {};
    for (let i = 0; i < size; i++) {
      const on: Record<string, { target: string }> = {};
      for (let j = 0; j < 6; j++) {
        on[`E${j}`] = { target: `s${(i + j + 1) % size}` };
      }
      states[`s${i}`] = { on };
    }
    const machine = createMachine({ id: 'big', initial: 's0', states });

    const coverage = createTestCoverage(machine);
    const pairs = getPairUniverse(coverage);

    expect(pairs.truncated).toBe(true);
    expect(coverage.transitionPairs.declarations.size).toBeLessThanOrEqual(
      2000
    );
    expect(coverage.transitionPairs.declarations.size).toBeGreaterThan(0);
  });
});

describe('deduplicatePaths', () => {
  it('matches the previous implementation on random path sets', () => {
    const random = createRandom(42);
    for (let round = 0; round < 200; round++) {
      const paths = randomPaths(
        random,
        1 + Math.floor(random() * 40),
        Math.floor(random() * 6),
        1 + Math.floor(random() * 3)
      );
      expect(deduplicatePaths(paths)).toEqual(deduplicatePathsOracle(paths));
      // Identity, not just structure: the same path objects in the same order.
      const actual = deduplicatePaths(paths);
      const expected = deduplicatePathsOracle(paths);
      expect(actual.length).toBe(expected.length);
      actual.forEach((path, index) => expect(path).toBe(expected[index]));
    }
  });

  it('honors a custom event serializer', () => {
    const random = createRandom(7);
    const paths = randomPaths(random, 100, 5, 4);
    const serialize = (event: EventObject) => event.type.slice(0, 1);
    const actual = deduplicatePaths(paths, serialize);
    const expected = deduplicatePathsOracle(paths, serialize);
    actual.forEach((path, index) => expect(path).toBe(expected[index]));
    expect(actual).toHaveLength(1);
  });

  it('handles empty inputs and empty paths', () => {
    expect(deduplicatePaths([])).toEqual([]);
    const empty: AnyPath[] = [
      { state: {} as any, weight: 0, steps: [] },
      { state: {} as any, weight: 0, steps: [] }
    ];
    const result = deduplicatePaths(empty);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(empty[0]);
  });

  it('deduplicates thousands of paths quickly', () => {
    const paths = randomPaths(createRandom(1), 5000, 20, 3);
    const start = performance.now();
    const result = deduplicatePaths(paths);
    const elapsed = performance.now() - start;

    expect(result.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1000);
  });
});
