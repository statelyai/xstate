import { Machine, assign } from 'xstate';

export default Machine<any>({
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
          cond: (ctx) => {
            return ctx.x === 99;
          },
          actions: assign({
            x: (ctx) => ctx.x + 1
          })
        }
      }
    },
    b: {
      // entry: ctx => {
      //   ctx.x *= 2;
      // },
      entry: assign({
        x: (ctx) => ctx.x * 2
      }),
      on: {
        '': [
          {
            target: 'c',
            cond: (ctx) => ctx.x === 200
          },
          { target: 'f' }
        ]
      }
    },
    c: {
      id: 'c'
    },
    f: {}
  }
});
