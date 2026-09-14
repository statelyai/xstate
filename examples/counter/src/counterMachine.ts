import { setup, types } from 'xstate';

export const counterMachine = setup({
  schemas: {
    context: types<{ count: number }>(),
    events: {
      increment: types<{}>(),
      decrement: types<{}>()
    }
  }
}).createMachine({
  id: 'counter',
  context: {
    count: 0
  },
  on: {
    increment: ({ context }) => ({
      context: { ...context, count: context.count + 1 }
    }),
    decrement: ({ context }) => ({
      context: { ...context, count: context.count - 1 }
    })
  }
});
