import { createMachine, assign, log } from 'xstate';

export default createMachine<any>({
  initial: 'a',
  context: {
    i: undefined
  },
  states: {
    a: {
      id: 'a',
      on: {
        t: {
          target: 'b',
          actions: assign({ i: 0 })
        }
      }
    },
    b: {
      always: [
        {
          target: 'b',
          guard: ({ context }) => {
            return context.i < 10;
          },
          actions: [
            assign({
              i: ({ context }) => context.i + 1
            }),
            log()
          ]
        },
        {
          target: '#c',
          guard: ({ context }) => context.i === 10
        }
      ]
    },
    c: {
      id: 'c'
    }
  }
});
