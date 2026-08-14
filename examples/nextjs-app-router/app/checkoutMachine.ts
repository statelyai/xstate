import { setup, types } from 'xstate';

/** The server-side machine: one checkout per session. */
export const checkoutMachine = setup({
  schemas: {
    context: types<{ items: number }>(),
    events: {
      addItem: types<{}>(),
      pay: types<{}>(),
      reset: types<{}>()
    }
  },
  guards: {
    hasItems: ({ context }: { context: { items: number } }) => context.items > 0
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
        pay: ({ context, guards }) =>
          guards.hasItems({ context }) ? { target: 'paid' } : undefined
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
