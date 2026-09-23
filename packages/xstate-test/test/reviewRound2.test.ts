import * as fc from 'fast-check';
import * as z from 'zod';
import { createMachine, types, type SnapshotFrom } from 'xstate';
import {
  ModelTestFailure,
  propertyTest,
  testPaths,
  type TestStateKey
} from '../src/index.ts';
import { expectTypeOf } from 'vitest';

const lightMachine = createMachine({
  id: 'light',
  schemas: { events: { NEXT: types<{}>() } },
  initial: 'green',
  states: {
    green: { on: { NEXT: { target: 'yellow' } } },
    yellow: { on: { NEXT: { target: 'red' } } },
    red: {
      initial: 'walk',
      states: { walk: { on: { NEXT: { target: 'stop' } } }, stop: {} }
    }
  }
});

describe('testPaths() with top-level `states` and no `sut`', () => {
  const recordStates = () => {
    const seen: string[] = [];
    return {
      seen,
      states: {
        yellow: () => {
          seen.push('yellow');
        },
        'red.walk': () => {
          seen.push('red.walk');
        }
      }
    };
  };

  it('accepts fast-check arbitraries', async () => {
    const { seen, states } = recordStates();
    await testPaths(lightMachine, {
      events: { NEXT: fc.constant({}) },
      states
    });

    expect(seen).toContain('yellow');
    expect(seen).toContain('red.walk');
  });

  it('accepts schema-derived events', async () => {
    const schemaMachine = createMachine({
      schemas: { events: { SET: z.object({ value: z.number().int() }) } },
      initial: 'idle',
      states: {
        idle: { on: { SET: { target: 'set' } } },
        set: {}
      }
    });
    const seen: unknown[] = [];
    const { results } = await testPaths(schemaMachine, {
      states: {
        set: (snapshot) => {
          seen.push(snapshot.value);
        }
      }
    });

    expect(results.length).toBeGreaterThan(0);
    expect(seen).toContain('set');
  });

  it('accepts `(rng) => payload` generators', async () => {
    const { seen, states } = recordStates();
    // Typed for arbitraries, but a plain generator passes through untouched.
    await testPaths(lightMachine, {
      events: { NEXT: (() => ({})) as never },
      states
    });

    expect(seen).toContain('red.walk');
  });
});

describe('fast-check run bounds', () => {
  const counterMachine = createMachine({
    schemas: {
      context: types<{ count: number }>(),
      events: { INC: types<{}>() }
    },
    context: { count: 0 },
    on: { INC: ({ context }) => ({ context: { count: context.count + 1 } }) }
  });

  it('reaches a `maxCommands` above fast-check’s default size', async () => {
    const { coverage } = await propertyTest(counterMachine, {
      seed: 1,
      numRuns: 50,
      maxCommands: 20,
      events: { INC: fc.constant({}) }
    });

    expect(coverage.exploration.maximumObservedSequenceLength).toBe(20);
  });

  it('bounds a batched campaign by `numRuns`', async () => {
    const { coverage } = await propertyTest(counterMachine, {
      seed: 1,
      numRuns: 7,
      until: () => false,
      events: { INC: fc.constant({}) }
    });

    expect(coverage.exploration.completedRuns).toBe(7);
    expect(coverage.exploration.configuredRuns).toBe(7);
  });
});

describe('types', () => {
  it('keeps the snapshot type in testPaths() results', () => {
    if (false as boolean) {
      void testPaths(lightMachine).then(({ results }) => {
        expectTypeOf(results[0].path.state).toEqualTypeOf<
          SnapshotFrom<typeof lightMachine>
        >();
      });
    }
  });

  it('suggests state-value keys for `states`', () => {
    type Key = TestStateKey<SnapshotFrom<typeof lightMachine>>;
    expectTypeOf<'red.walk'>().toMatchTypeOf<Key>();
    expectTypeOf<'green'>().toMatchTypeOf<Key>();
    expectTypeOf<'#light.red'>().toMatchTypeOf<Key>();
    expectTypeOf<'*'>().toMatchTypeOf<Key>();
  });

  it('keeps the trace typed after `instanceof`', () => {
    const error: unknown = undefined;
    if (error instanceof ModelTestFailure) {
      expectTypeOf(error.trace).not.toBeAny();
      expectTypeOf(error.trace.finalSnapshot).not.toBeAny();
    }
  });
});
