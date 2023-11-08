import { createMachine, assign } from 'xstate';

export const machine = createMachine({
  id: 'counter',
  initial: 'green',
  context: {
    cycles: 0
  },
  states: {
    green: {
      on: {
        TIMER: 'yellow'
      }
    },
    yellow: {
      on: {
        TIMER: 'red'
      }
    },
    red: {
      on: {
        TIMER: {
          target: 'green',
          actions: assign({
            cycles: ({ context }) => context.cycles + 1
          })
        }
      }
    }
  }
});
