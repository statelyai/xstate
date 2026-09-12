import { types, createMachine } from 'xstate';

export const counterMachine = createMachine({
  schemas: { events: { increase: types<{}>() } },
  context: { count: 0 },
  on: {
    increase: ({ context }) => ({ context: { count: context.count + 1 } })
  }
});
