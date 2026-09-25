import * as fc from 'fast-check';
import type { SnapshotFrom } from 'xstate';
import {
  assertTestCoverage,
  eventsFromSchemas,
  formatTestCoverage,
  pick,
  propertyTest,
  testPaths,
  ModelTestFailure,
  replayTest,
  type TestFixture
} from '@xstate/test';
import { it as modelIt } from '@xstate/test/vitest';
import { CartStore, type CartEvent } from './cart-store.ts';
import { cartMachine } from './cart.machine.ts';

type CartSnapshot = SnapshotFrom<typeof cartMachine>;

/**
 * `REMOVE` only makes sense for a SKU that is in the cart, and the SKUs are
 * invented by `ADD` during the run, so there is nothing to generate up front.
 * `pick()` generates a shrinkable index into the SKUs the cart holds at that
 * step, and skips the event when the cart is empty.
 */
const removeAnItemInTheCart = pick(
  (snapshot: CartSnapshot) => Object.keys(snapshot.context.items),
  (sku) => ({ sku })
);

/** The cart's buttons exist only while shopping. */
const whileShopping = ({ snapshot }: { snapshot: CartSnapshot }) =>
  snapshot.matches('shopping');

/** Generators derived from the machine's Zod event schemas. */
const derived = eventsFromSchemas(cartMachine) as {
  ADD: fc.Arbitrary<{ sku: string; qty: number }>;
  CHECKOUT: fc.Arbitrary<{}>;
};

describe('cart', () => {
  it('checks out, and never holds an item at quantity zero', async () => {
    const { coverage } = await propertyTest(cartMachine, {
      seed: 1,
      numRuns: 100,
      maxCommands: 10,
      // Every event is offered only while shopping, as a page would disable
      // the cart's buttons during payment. `ADD` and `CHECKOUT` payloads come
      // from the machine's Zod event schemas.
      events: {
        ADD: { generate: derived.ADD, when: whileShopping },
        REMOVE: { ...removeAnItemInTheCart, when: whileShopping },
        CHECKOUT: { generate: derived.CHECKOUT, when: whileShopping }
      },
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
          // While paying, only the payment outcome can happen, so the next
          // step leaves `paying`.
          type: 'respond',
          id: 'payment-settles',
          within: 1,
          trigger: ({ snapshot }) => snapshot.matches('paying'),
          response: ({ snapshot }) => !snapshot.matches('paying')
        },
        {
          // Some run must see a declined payment.
          type: 'sometimes',
          id: 'declined',
          predicate: ({ snapshot }) => snapshot.context.lastError !== null
        }
      ],
      // Some run must check out.
      reachable: ['#cart.done'],
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

    describe('with CART_BUG=1', () => {
      beforeAll(() => {
        process.env.CART_BUG = '1';
      });
      afterAll(() => {
        delete process.env.CART_BUG;
      });

      // The counterexample is shrunk to the shortest sequence that diverges:
      // add an item, remove it, and the store still holds it at zero. The
      // failure is saved under `.xstate-test/` and replayed first next time.
      modelIt.model.fails(
        'reports a counterexample when the store is buggy',
        cartMachine,
        options,
        { message: /Property observation diverged[\s\S]*REMOVE/ }
      );
    });
  });

  /**
   * The same machine and the same oracles as the tests above, run through
   * graph traversal instead of generated sequences. Only the generation keys
   * change.
   */
  describe('path testing the same cart', () => {
    const cartSut = {
      create: () => {
        const store = new CartStore();
        return {
          send: (event: CartEvent) => store.dispatch(event),
          read: () => store.getState().items
        };
      },
      projectModel: (snapshot: { context: { items: unknown } }) =>
        snapshot.context.items
    };

    const pathOptions = {
      deriveEvents: false,
      // Simple paths, so a `REMOVE` that leads somewhere already reachable is
      // still walked; shortest paths would skip it.
      pathGenerator: 'simple',
      // One concrete payload per event case, so the graph stays small.
      samples: 1,
      seed: 3,
      events: {
        ADD: [
          { case: 'apple', generate: fc.constant({ sku: 'apple', qty: 1 }) },
          { case: 'pear', generate: fc.constant({ sku: 'pear', qty: 1 }) }
        ],
        // Traversal needs a fixed SKU per case rather than the shrinkable
        // index the property tests use, so every edge is a stable graph edge.
        REMOVE: [
          { case: 'apple', generate: fc.constant({ sku: 'apple' }) },
          { case: 'pear', generate: fc.constant({ sku: 'pear' }) }
        ]
      },
      // The cart would otherwise grow without bound, and traversal with it.
      stopWhen: (snapshot: SnapshotFrom<typeof cartMachine>) =>
        Object.values(snapshot.context.items).some((qty) => qty >= 2)
    } as const;

    it('walks every simple path', async () => {
      const { coverage, results } = await testPaths(cartMachine, {
        ...pathOptions,
        // Real actors run, so the `xstate.done.actor` and
        // `xstate.error.actor` steps the traversal took become `outcome`
        // commands against a stubbed `pay`.
        mode: 'executed',
        outcomes: {
          pay: fc.constant({ ok: true, output: { receiptId: 'rcpt_1' } })
        },
        invariant: ({ snapshot }) => {
          for (const [sku, qty] of Object.entries(snapshot.context.items)) {
            expect(qty, `quantity of ${sku}`).toBeGreaterThan(0);
          }
        }
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(({ passed }) => passed)).toBe(true);
      // The same coverage object `propertyTest()` returns.
      expect(coverage.exploration.strategy).toBe('paths');
      expect(coverage.exploration.pathCount).toBe(results.length);
      // Every transition, `paying --> done` and `paying --> shopping`
      // included: only executed mode can reach those.
      expect(coverage.transitions.uncovered).toEqual([]);
      expect(coverage.transitions.unknown).toEqual([]);
      console.log(formatTestCoverage(coverage));
    });

    it('reports the same failure class when the store is buggy', async () => {
      process.env.CART_BUG = '1';
      let failure!: ModelTestFailure;
      try {
        // `REMOVE` returns the cart to its starting state, so no shortest
        // path covers it. A literal sequence does.
        await testPaths(cartMachine, {
          ...pathOptions,
          sut: cartSut,
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
    try {
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
    } finally {
      delete process.env.CART_BUG;
    }
  });
});
