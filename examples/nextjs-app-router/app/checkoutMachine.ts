import { setup, types } from 'xstate';

const hasItems = (items: number) => items > 0;

/** The server-side machine: one checkout per session. */
export const checkoutMachine = setup({
  schemas: {
    context: types<{ items: number }>(),
    events: {
      addItem: types<{}>(),
      pay: types<{}>(),
      reset: types<{}>()
    }
  }
}).createMachine({
  id: 'checkout',
  context: { items: 0 },
  initial: 'shopping',
  states: {
    shopping: {
      on: {
        addItem: ({ context }) => ({
          context: { items: context.items + 1 }
        }),
        pay: ({ context }) =>
          hasItems(context.items) ? { target: 'paid' } : undefined
      }
    },
    paid: {
      on: {
        reset: ({ context }) => ({
          target: 'shopping',
          context: { items: 0 }
        })
      }
    }
  }
});
