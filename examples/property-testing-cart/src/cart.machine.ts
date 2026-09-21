import { createAsyncLogic, setup, types } from 'xstate';
import * as z from 'zod';

/** Quantity per SKU. A SKU is present only while its quantity is above zero. */
export type CartItems = Record<string, number>;

export interface CartContext {
  items: CartItems;
}

/**
 * Stands in for a payment call. Property tests replace it with a generated
 * outcome, so the test controls whether payment succeeds or is declined.
 */
const pay = createAsyncLogic({
  run: async ({ input }: { input: { total: number } }) => ({
    receiptId: `rcpt_${input.total}`
  })
});

function countItems(items: CartItems): number {
  return Object.values(items).reduce((total, qty) => total + qty, 0);
}

/**
 * The event schemas are Zod schemas, so `propertyTest()` from `@xstate/test`
 * derives generators for `ADD` and `CHECKOUT` without being told how.
 */
export const cartMachine = setup({
  schemas: {
    context: types<CartContext>(),
    events: {
      ADD: z.object({
        sku: z.string().min(1),
        qty: z.number().int().min(1).max(5)
      }),
      REMOVE: z.object({ sku: z.string() }),
      CHECKOUT: z.object({})
    }
  },
  actors: { pay }
}).createMachine({
  id: 'cart',
  context: { items: {} },
  initial: 'shopping',
  states: {
    shopping: {
      on: {
        // `qty` is declared as an integer of at least one, so the derived
        // generator never produces a quantity below one.
        ADD: ({ context, event }) => ({
          context: {
            items: {
              ...context.items,
              [event.sku]: (context.items[event.sku] ?? 0) + event.qty
            }
          }
        }),
        REMOVE: ({ context, event }) => {
          const { [event.sku]: _removed, ...items } = context.items;
          return { context: { items } };
        },
        // An empty cart cannot be checked out: the transition returns nothing,
        // so the event is not handled in that case.
        CHECKOUT: ({ context }) =>
          Object.keys(context.items).length ? { target: 'paying' } : undefined
      }
    },
    paying: {
      invoke: {
        src: 'pay',
        input: ({ context }) => ({ total: countItems(context.items) }),
        onDone: { target: 'done' },
        // A declined payment returns the shopper to the cart, contents intact.
        onError: { target: 'shopping' }
      }
    },
    done: { type: 'final' }
  }
});
