import { types, createMachine } from 'xstate';

export const counterMachine = createMachine({
  schemas: { events: { increment: types<{}>(), decrement: types<{}>() } },
  context: { count: 0 },
  on: {
    increment: ({ context }) => ({ context: { count: context.count + 1 } }),
    decrement: ({ context }) => ({ context: { count: context.count - 1 } })
  }
});
