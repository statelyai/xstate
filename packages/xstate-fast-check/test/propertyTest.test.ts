import * as fc from 'fast-check';
import { createMachine, types } from 'xstate';
import {
  PropertyTestFailure,
  createTestModel,
  propertyTest
} from 'xstate/graph';
import { fastCheckAdapter } from '../src/index.ts';

const counterMachine = createMachine({
  schemas: {
    context: types<{ count: number }>(),
    events: {
      INC: types<{ value: number }>(),
      RESET: types<{}>()
    }
  },
  context: { count: 0 },
  on: {
    INC: ({ context, event }) => ({
      context: { count: context.count + event.value }
    }),
    RESET: () => ({ context: { count: 0 } })
  }
});

describe('propertyTest with FastCheck', () => {
  it('accepts machines and test models and checks every macrostep', async () => {
    for (const source of [counterMachine, createTestModel(counterMachine)]) {
      const checked: number[] = [];
      const result = await propertyTest(source, {
        adapter: fastCheckAdapter({ seed: 42, numRuns: 5, maxCommands: 3 }),
        events: {
          INC: fc.record({ value: fc.integer({ min: 0, max: 2 }) }),
          RESET: fc.constant({})
        },
        invariant: ({ snapshot }) => {
          checked.push(snapshot.context.count);
        }
      });

      expect(result.coverage.runs).toBe(5);
      expect(checked.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('shrinks failures and exposes replay metadata', async () => {
    const run = () =>
      propertyTest(counterMachine, {
        adapter: fastCheckAdapter({ seed: 123, numRuns: 20, maxCommands: 10 }),
        events: {
          INC: fc.record({ value: fc.integer({ min: 1, max: 1_000 }) })
        },
        invariant: ({ snapshot }) => {
          expect(snapshot.context.count).toBeLessThan(10);
        }
      });

    const error = await run().catch((value) => value);
    expect(error).toBeInstanceOf(PropertyTestFailure);
    expect(error.trace.steps.length).toBeGreaterThan(0);
    expect(error.replay).toMatchObject({
      engine: 'fast-check',
      seed: expect.any(Number),
      path: expect.any(String)
    });
  });

  it('does not execute returned effects', async () => {
    let executed = 0;
    const machine = createMachine({
      on: {
        GO: (_, enq) => enq(() => executed++)
      }
    });

    await propertyTest(machine, {
      adapter: fastCheckAdapter({ seed: 1, numRuns: 5, maxCommands: 5 }),
      events: { GO: fc.constant({}) },
      invariant: () => {}
    });

    expect(executed).toBe(0);
  });
});
