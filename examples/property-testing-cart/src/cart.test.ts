import * as fc from 'fast-check';
import type { SnapshotFrom } from 'xstate';
import {
  assertTestCoverage,
  formatTestCoverage,
  propertyTest,
  testPaths,
  ModelTestFailure,
  replayTest,
  type TestFixture
} from '@xstate/test';
import { CartStore, type CartEvent } from './cart-store.ts';
import { cartMachine } from './cart.machine.ts';

/**
 * `REMOVE` only makes sense for a SKU that is in the cart, and the SKUs are
 * invented by `ADD` during the run, so there is nothing to generate up front.
 * `generate` produces a shrinkable index and `resolve` turns it into whichever
 * SKU the cart holds at that step; returning `undefined` skips the event.
 */
const removeAnItemInTheCart = {
  generate: fc.nat(),
  resolve: ({
    snapshot,
    generated
  }: {
    snapshot: SnapshotFrom<typeof cartMachine>;
    generated: unknown;
  }) => {
    const skus = Object.keys(snapshot.context.items);
    return skus.length
      ? { sku: skus[(generated as number) % skus.length] }
      : undefined;
  }
};

describe('cart', () => {
  it('checks out, and never holds an item at quantity zero', async () => {
    const { coverage } = await propertyTest(cartMachine, {
      seed: 1,
      numRuns: 100,
      maxCommands: 10,
      // `ADD` and `CHECKOUT` come from the machine's Zod event schemas.
      events: { REMOVE: removeAnItemInTheCart },
      // Real actors run, so `pay` resolves and `onDone`/`onError` fire.
      mode: 'executed',
      outcomes: {
        pay: fc.oneof(
          fc.constant({ ok: true, output: { receiptId: 'rcpt_1' } }),
          fc.constant({ ok: false, error: new Error('card declined') })
        )
      },
      invariant: ({ snapshot }) => {
        for (const [sku, qty] of Object.entries(snapshot.context.items)) {
          expect(qty, `quantity of ${sku}`).toBeGreaterThan(0);
        }
      },
      temporal: [
        {
          type: 'eventually',
          id: 'checks-out',
          within: 20,
          predicate: ({ snapshot }) => snapshot.matches('done')
        }
      ],
      // Stop as soon as every transition has been covered.
      until: { transitions: 1 }
    });

    console.log(formatTestCoverage(coverage));
    assertTestCoverage(coverage, { transitions: 1 });
  });

  describe('against the CartStore implementation', () => {
    /**
     * The cart contents are what the two implementations must agree on, so
     * that is all the projections compare. The checkout path is covered by the
     * model-only test above, and `deriveEvents: false` keeps `CHECKOUT` out of
     * the generated events here.
     */
    const options = {
      seed: 2,
      numRuns: 100,
      maxCommands: 12,
      deriveEvents: false,
      events: {
        ADD: fc.record({
          sku: fc.constantFrom('apple', 'pear', 'plum'),
          qty: fc.integer({ min: 1, max: 5 })
        }),
        REMOVE: removeAnItemInTheCart
      },
      sut: {
        create: () => {
          const store = new CartStore();
          return {
            send: (event: CartEvent) => store.dispatch(event),
            read: () => store.getState().items
          };
        },
        projectModel: (snapshot: { context: { items: unknown } }) =>
          snapshot.context.items
      },
      invariant: () => {}
    } as const;

    it('matches the model', async () => {
      await propertyTest(cartMachine, options);
    });

    it('reports a counterexample when the store is buggy', async () => {
      process.env.CART_BUG = '1';
      let failure!: ModelTestFailure;
      try {
        await propertyTest(cartMachine, options);
      } catch (error) {
        failure = error as ModelTestFailure;
      } finally {
        delete process.env.CART_BUG;
      }

      expect(failure).toBeInstanceOf(ModelTestFailure);
      // The counterexample is shrunk to the shortest sequence that diverges:
      // add an item, remove it, and the store still holds it at zero.
      expect(failure.message).toContain('REMOVE');
      const lastStep = failure.trace.timeline.at(-1);
      expect(lastStep?.kind).toBe('event');
      expect(lastStep?.kind === 'event' && lastStep.command).toMatchObject({
        type: 'event',
        event: { type: 'REMOVE' }
      });
      console.log(failure.message);
    });
  });

  /**
   * The same machine, the same `sut`, and the same oracles as test 2, run
   * through graph traversal instead of generated sequences. Only the
   * generation keys change.
   */
  describe('path testing the same cart', () => {
    const pathOptions = {
      deriveEvents: false,
      // One concrete payload per event case, so the graph stays small.
      samples: 1,
      seed: 3,
      events: {
        ADD: fc.record({
          sku: fc.constant('apple'),
          qty: fc.constant(1)
        }),
        REMOVE: removeAnItemInTheCart
      },
      // The cart would otherwise grow without bound, and traversal with it.
      stopWhen: (snapshot: SnapshotFrom<typeof cartMachine>) =>
        (snapshot.context.items.apple ?? 0) >= 2,
      sut: {
        create: () => {
          const store = new CartStore();
          return {
            send: (event: CartEvent) => store.dispatch(event),
            read: () => store.getState().items
          };
        },
        projectModel: (snapshot: { context: { items: unknown } }) =>
          snapshot.context.items
      }
    } as const;

    it('walks every shortest path', async () => {
      const { coverage, results } = await testPaths(cartMachine, pathOptions);

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(({ passed }) => passed)).toBe(true);
      // The same coverage object `propertyTest()` returns.
      expect(coverage.exploration.strategy).toBe('paths');
      expect(coverage.exploration.pathCount).toBe(results.length);
      console.log(formatTestCoverage(coverage));
    });

    it('reports the same failure class when the store is buggy', async () => {
      process.env.CART_BUG = '1';
      let failure!: ModelTestFailure;
      try {
        // `REMOVE` returns the cart to its starting state, so no shortest or
        // simple path covers it. A literal sequence does.
        await testPaths(cartMachine, {
          ...pathOptions,
          fromEvents: [
            { type: 'ADD', sku: 'apple', qty: 1 },
            { type: 'REMOVE', sku: 'apple' }
          ]
        });
      } catch (error) {
        failure = error as ModelTestFailure;
      } finally {
        delete process.env.CART_BUG;
      }

      expect(failure).toBeInstanceOf(ModelTestFailure);
      expect(failure.fixture).toBeDefined();
      expect(failure.coverage?.exploration.strategy).toBe('paths');
    });
  });

  it('replays a recorded counterexample', async () => {
    process.env.CART_BUG = '1';
    let fixture: TestFixture | undefined;
    try {
      await propertyTest(cartMachine, {
        seed: 2,
        numRuns: 100,
        maxCommands: 12,
        deriveEvents: false,
        events: {
          ADD: fc.record({
            sku: fc.constantFrom('apple', 'pear', 'plum'),
            qty: fc.integer({ min: 1, max: 5 })
          }),
          REMOVE: removeAnItemInTheCart
        },
        sut: {
          create: () => {
            const store = new CartStore();
            return {
              send: (event: CartEvent) => store.dispatch(event),
              read: () => store.getState().items
            };
          },
          projectModel: (snapshot) => snapshot.context.items
        },
        invariant: () => {}
      });
    } catch (error) {
      fixture = (error as ModelTestFailure).fixture;
    }

    expect(fixture).toBeDefined();

    // The fixture is plain JSON: commit it and the same failure is reproduced
    // without generating anything. `replayTest()` expects the recorded
    // failure to happen again, and throws `ReplayNotReproducedError`
    // when it does not.
    const reproduced = replayTest(cartMachine, fixture!, {
      sut: {
        create: () => {
          const store = new CartStore();
          return {
            send: (event: CartEvent) => store.dispatch(event),
            read: () => store.getState().items
          };
        },
        projectModel: (snapshot) => snapshot.context.items
      },
      invariant: () => {}
    });
    await expect(reproduced).rejects.toBeInstanceOf(ModelTestFailure);
    delete process.env.CART_BUG;
  });
});
