import { setup, types } from 'xstate';

export const counterMachine = setup({
  schemas: {
    context: types<{ count: number }>(),
    events: {
      INCREMENT: types<{}>()
    }
  }
}).createMachine({
  id: 'counter',
  context: { count: 0 },
  on: {
    INCREMENT: ({ context }) => ({
      context: { count: context.count + 1 }
    })
  }
});
