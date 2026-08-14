import { setup, types } from 'xstate';

export interface CheckoutContext {
  zip: string | null;
  error: string | null;
  paid: boolean;
}

/**
 * The *model*: a deliberately small checkout flow. It is not the code under
 * test — it is the specification that test paths are generated from.
 */
export const checkoutMachine = setup({
  schemas: {
    context: types<CheckoutContext>(),
    events: {
      startCheckout: types<{}>(),
      submitAddress: types<{ zip: string }>(),
      pay: types<{ card: string }>(),
      back: types<{}>(),
      retry: types<{}>()
    }
  }
}).createMachine({
  context: { zip: null, error: null, paid: false },
  initial: 'cart',
  states: {
    cart: {
      on: {
        startCheckout: { target: 'shipping' }
      }
    },
    shipping: {
      on: {
        // A transition function branches on the event payload, so the same
        // event type covers two equivalence classes: valid and invalid ZIP.
        submitAddress: ({ event }) =>
          /^\d{5}$/.test(event.zip)
            ? {
                target: 'payment' as const,
                context: { zip: event.zip, error: null }
              }
            : { context: { error: 'Enter a 5-digit ZIP code' } }
      }
    },
    payment: {
      on: {
        pay: ({ event }) =>
          event.card.startsWith('4')
            ? { target: 'confirmed' as const, context: { paid: true } }
            : {
                target: 'declined' as const,
                context: { error: 'Card declined' }
              },
        back: { target: 'shipping' }
      }
    },
    declined: {
      on: {
        retry: { target: 'payment', context: { error: null } }
      }
    },
    confirmed: { type: 'final' }
  }
});
