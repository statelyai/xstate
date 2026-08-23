import { setup, types } from 'xstate';

export const ORDER_EVENTS = ['pay', 'ship', 'deliver', 'cancel'] as const;

export type OrderEvent =
  | { type: 'pay'; amount: number }
  | { type: 'ship'; carrier: string }
  | { type: 'deliver' }
  | { type: 'cancel'; reason: string };

/** One order per Durable Object. Small on purpose: the point is the hosting. */
export const orderMachine = setup({
  schemas: {
    context: types<{
      paid: number;
      carrier: string | null;
      cancelReason: string | null;
    }>(),
    events: {
      pay: types<{ amount: number }>(),
      ship: types<{ carrier: string }>(),
      deliver: types<{}>(),
      cancel: types<{ reason: string }>()
    }
  }
}).createMachine({
  id: 'order',
  context: { paid: 0, carrier: null, cancelReason: null },
  initial: 'awaitingPayment',
  states: {
    awaitingPayment: {
      on: {
        pay: ({ event }) => ({
          target: 'paid',
          context: { paid: event.amount }
        }),
        cancel: ({ event }) => ({
          target: 'cancelled',
          context: { cancelReason: event.reason }
        })
      }
    },
    paid: {
      on: {
        ship: ({ event }) => ({
          target: 'shipped',
          context: { carrier: event.carrier }
        }),
        cancel: ({ event }) => ({
          target: 'cancelled',
          context: { cancelReason: event.reason }
        })
      }
    },
    shipped: {
      on: { deliver: { target: 'delivered' } }
    },
    delivered: { type: 'final' },
    cancelled: { type: 'final' }
  }
});
