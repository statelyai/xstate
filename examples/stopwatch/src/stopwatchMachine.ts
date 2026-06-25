import { createMachine, createCallbackLogic } from 'xstate';

export const stopwatchMachine = createMachine({
  actorSources: {
    ticks: createCallbackLogic(({ sendBack }) => {
      const interval = setInterval(() => {
        sendBack({ type: 'TICK' });
      }, 10);
      return () => clearInterval(interval);
    })
  },
  id: 'stopwatch',
  initial: 'stopped',
  context: {
    elapsed: 0
  },
  states: {
    stopped: {
      on: {
        start: 'running'
      }
    },
    running: {
      invoke: {
        src: 'ticks'
      },
      on: {
        TICK: ({ context, event, guards, actions }, enq) => {
          return {
            context: {
              ...context,
              elapsed: (({ context }) => context.elapsed + 1)({
                context: context,
                event: event
              })
            }
          };
        },
        stop: 'stopped'
      }
    }
  },
  on: {
    reset: ({ context, event, guards, actions }, enq) => {
      return { target: '.stopped', context: { ...context, elapsed: 0 } };
    }
  }
});
