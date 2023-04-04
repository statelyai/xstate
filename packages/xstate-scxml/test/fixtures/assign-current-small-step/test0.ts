import { createMachine, assign } from 'xstate';

export default createMachine<any>({
  initial: 'a',
  context: {
    x: undefined
  },
  states: {
    a: {
      id: 'a',
      entry: [assign({ x: -1 }), assign({ x: 99 })],
      on: {
        t: {
          target: 'b',
          guard: ({ context }) => {
            return context.x === 99;
          },
          actions: assign({
            x: ({ context }) => context.x + 1
          })
        }
      }
    },
    b: {
      // entry: ctx => {
      //   ctx.x *= 2;
      // },
      entry: assign({
        x: ({ context }) => context.x * 2
      }),
      always: [
        {
          target: 'c',
          guard: ({ context }) => context.x === 200
        },
        { target: 'f' }
      ]
    },
    c: {
      id: 'c'
    },
    f: {}
  }
});
