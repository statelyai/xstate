import { createMachine } from 'xstate';

export const counterMachine = createMachine({
  id: 'counter',
  context: {
    count: 0
  },
  on: {
    increment: ({ context, event, guards, actions }, enq) => {
      return {
        context: {
          ...context,
          count: (({ context }) => context.count + 1)({
            context: context,
            event: event
          })
        }
      };
    },
    decrement: ({ context, event, guards, actions }, enq) => {
      return {
        context: {
          ...context,
          count: (({ context }) => context.count - 1)({
            context: context,
            event: event
          })
        }
      };
    }
  }
});
