import { createMachine } from 'xstate';

export const counterMachine = createMachine({
  types: {
    context: {} as { count: number },
    events: {} as { type: 'increase' }
  },
  context: {
    count: 0
  },
  id: 'Counter',
  initial: 'ready',
  states: {
    ready: {
      on: {
        increase: ({ context, event, guards, actions }, enq) => {
          return {
            target: 'ready',
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
    }
  }
});
