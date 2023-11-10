import { assign, createMachine, fromCallback } from 'xstate';

export const stopwatchMachine = createMachine({
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
        src: fromCallback(({ sendBack }) => {
          const interval = setInterval(() => {
            sendBack({ type: 'TICK' });
          }, 10);
          return () => clearInterval(interval);
        })
      },
      on: {
        TICK: {
          actions: assign({
            elapsed: ({ context }) => context.elapsed + 1
          })
        },
        stop: 'stopped'
      }
    }
  },
  on: {
    reset: {
      actions: assign({
        elapsed: 0
      }),
      target: '.stopped'
    }
  }
});
