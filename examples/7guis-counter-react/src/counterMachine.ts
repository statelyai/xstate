import { createMachine } from 'xstate';

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
    INCREMENT: ({ context, event, guards, actions }, enq) => {
      return {
        context: {
          ...context,
          count: (({ context }) => context.count + 1)({
            context: context,
            event: event
          })
        }
      };
    }
  }
});
