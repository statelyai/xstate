import { Machine, actions } from 'xstate';

const { assign } = actions;

// Action to increment the context amount
const addWater = assign({
  amount: (ctx, event) => ctx.amount + 1
});

// Guard to check if the glass is full
function glassIsFull(ctx, event) {
  return ctx.amount >= 10;
}

export const glassMachine = Machine(
  {
    id: 'glass',
    // the initial context (extended state) of the statechart
    context: {
      amount: 0
    },
    initial: 'empty',
    states: {
      empty: {
        on: {
          FILL: {
            target: 'filling',
            actions: 'addWater'
          }
        }
      },
      filling: {
        on: {
          '': {
            target: 'full',
            cond: 'glassIsFull'
          },
          FILL: {
            target: 'filling',
            actions: 'addWater'
          }
        }
      },
      full: {}
    }
  },
  {
    actions: { addWater },
    guards: { glassIsFull }
  }
);
