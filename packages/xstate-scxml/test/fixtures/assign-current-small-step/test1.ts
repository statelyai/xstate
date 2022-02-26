import { Machine, assign, actions } from 'xstate';

const { log } = actions;

export default Machine<any>({
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
      on: {
        '': [
          {
            target: 'b',
            cond: (ctx) => {
              return ctx.i < 10;
            },
            actions: [
              assign({
                i: (ctx) => ctx.i + 1
              }),
              log()
            ]
          },
          {
            target: '#c',
            cond: (ctx) => ctx.i === 10
          }
        ]
      }
    },
    c: {
      id: 'c'
    }
  }
});
