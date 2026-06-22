import { createMachine } from 'xstate';

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
        TIMER: ({ context, event, guards, actions }, enq) => {
          return {
            target: 'green',
            context: {
              ...context,
              cycles: (({ context }) => context.cycles + 1)({
                context: context,
                event: event
              })
            }
          };
        }
      }
    }
  }
});
