import { types, createMachine } from 'xstate';

export const counterMachine = createMachine({
  schemas: { events: { INCREMENT: types<{}>() } },
  context: { count: 0 },
  on: {
    INCREMENT: ({ context }) => ({ context: { count: context.count + 1 } })
  }
});
