import { assign, createMachine } from 'xstate';

export const timerMachine = createMachine({
  schema: {
    events: {} as
      | { type: 'start' }
      | { type: 'stop' }
      | { type: 'reset' }
      | { type: 'minute' }
      | { type: 'second' }
      | { type: 'TICK' }
  },
  context: {
    seconds: 0
  },
  initial: 'stopped',
  states: {
    stopped: {
      on: {
        start: {
          cond: (context) => context.seconds > 0,
          target: 'running'
        },
        minute: {
          actions: assign({
            seconds: (context) => context.seconds + 60
          })
        },
        second: {
          actions: assign({
            seconds: (context) => context.seconds + 1
          })
        }
      }
    },
    running: {
      invoke: {
        src: () => (sendBack) => {
          const interval = setInterval(() => {
            sendBack({ type: 'TICK' });
          }, 1000);
          return () => clearInterval(interval);
        }
      },
      on: {
        stop: 'stopped',
        TICK: {
          actions: assign({
            seconds: (context) => context.seconds - 1
          })
        }
      },
      always: {
        cond: (context) => context.seconds === 0,
        target: 'stopped'
      }
    }
  },
  on: {
    reset: {
      cond: (context) => context.seconds > 0,
      actions: assign({
        seconds: 0
      })
    }
  }
});
