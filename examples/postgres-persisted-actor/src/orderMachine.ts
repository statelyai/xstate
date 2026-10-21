import { setup, types } from 'xstate';

/** Event names the prompt accepts, and a guard for validating typed input. */
export const ORDER_EVENTS = [
  'ADD_ITEM',
  'CHECKOUT',
  'PAYMENT_OK',
  'PAYMENT_FAILED',
  'SHIP',
  'DELIVER',
  'CANCEL'
] as const;

export type OrderEventType = (typeof ORDER_EVENTS)[number];

export const isOrderEvent = (value: string): value is OrderEventType =>
  (ORDER_EVENTS as readonly string[]).includes(value);

/** A small order workflow, driven entirely by events typed at the prompt. */
export const orderMachine = setup({
  schemas: {
    context: types<{ items: number; attempts: number }>(),
    events: {
      ADD_ITEM: types<{}>(),
      CHECKOUT: types<{}>(),
      PAYMENT_OK: types<{}>(),
      PAYMENT_FAILED: types<{}>(),
      SHIP: types<{}>(),
      DELIVER: types<{}>(),
      CANCEL: types<{}>()
    }
  }
}).createMachine({
  id: 'order',
  context: { items: 0, attempts: 0 },
  initial: 'cart',
  states: {
    cart: {
      on: {
        ADD_ITEM: ({ context }) => ({
          context: { items: context.items + 1 }
        }),
        CHECKOUT: ({ context }) =>
          context.items > 0 ? { target: 'awaitingPayment' } : undefined,
        CANCEL: { target: 'cancelled' }
      }
    },
    awaitingPayment: {
      on: {
        PAYMENT_OK: { target: 'paid' },
        PAYMENT_FAILED: ({ context }) => ({
          context: { attempts: context.attempts + 1 }
        }),
        CANCEL: { target: 'cancelled' }
      }
    },
    paid: {
      on: { SHIP: { target: 'shipped' } }
    },
    shipped: {
      on: { DELIVER: { target: 'delivered' } }
    },
    delivered: {
      type: 'final',
      output: ({ context }) => ({
        items: context.items,
        failedPayments: context.attempts
      })
    },
    cancelled: {
      type: 'final',
      output: () => ({ cancelled: true })
    }
  }
});
