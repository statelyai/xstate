import { assign, createMachine } from 'xstate';

export const toggleMachine = createMachine<{ count: number }>({
  predictableActionArguments: true,
  id: 'toggle',
  initial: 'inactive',
  context: {
    count: 0
  },
  states: {
    inactive: {
      on: { TOGGLE: 'active' }
    },
    active: {
      entry: assign({ count: (ctx) => ctx.count + 1 }),
      on: { TOGGLE: 'inactive' }
    }
  }
});
