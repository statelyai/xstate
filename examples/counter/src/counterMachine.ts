import { assign, createMachine } from 'xstate';

export const counterMachine = createMachine({
  id: 'counter',
  context: {
    count: 0
  },
  on: {
    increment: {
      actions: assign({
        count: ({ context }) => context.count + 1
      })
    },
    decrement: {
      actions: assign({
        count: ({ context }) => context.count - 1
      })
    }
  }
});
