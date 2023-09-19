import { createMachine, assign } from 'xstate';

interface CounterContext {
  count: number;
}

type CounterEvent = {
  type: 'INCREMENT';
};

export const counterMachine = createMachine({
  types: {} as {
    context: CounterContext;
    events: CounterEvent;
  },
  id: 'counter',
  context: { count: 0 },
  on: {
    INCREMENT: {
      actions: assign({ count: ({ context }) => context.count + 1 })
    }
  }
});
