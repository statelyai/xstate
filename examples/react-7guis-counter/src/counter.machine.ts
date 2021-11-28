import { createMachine, assign } from 'xstate';

interface CounterContext {
  count: number;
}

type CounterEvent = {
  type: 'INCREMENT';
};

export const counterMachine = createMachine<CounterContext, CounterEvent>({
  id: 'counter',
  context: { count: 0 },
  on: {
    INCREMENT: {
      actions: assign({ count: (ctx) => ctx.count + 1 })
    }
  }
});
