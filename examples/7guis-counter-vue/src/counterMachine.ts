import { setup, types } from 'xstate';

export const counterMachine = setup({
  schemas: {
    context: types<{ count: number }>(),
    events: {
      increase: types<{}>()
    }
  }
}).createMachine({
  id: 'counter',
  context: { count: 0 },
  on: {
    increase: ({ context }) => ({
      context: { count: context.count + 1 }
    })
  }
});
