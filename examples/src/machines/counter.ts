import { Machine, actions, TransitionConfig } from 'xstate';
const { assign } = actions;

interface CounterContext {
  count: number;
}

export const counterMachine = Machine<CounterContext>({
  id: 'counter',
  initial: 'counting',
  context: {
    count: 0
  },
  states: {
    counting: {
      on: {
        INCREMENT: {
          actions: assign<CounterContext>({
            count: ctx => ctx.count + 1
          })
        },
        DECREMENT: {
          actions: assign<CounterContext>({
            count: ctx => ctx.count - 1
          })
        }
      }
    }
  }
});
