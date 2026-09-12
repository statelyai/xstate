import { createCallbackLogic, setup, types } from 'xstate';

export const timerMachine = setup({
  schemas: {
    context: types<{ seconds: number }>(),
    events: {
      start: types<{}>(),
      stop: types<{}>(),
      reset: types<{}>(),
      minute: types<{}>(),
      second: types<{}>(),
      TICK: types<{}>()
    }
  },
  actors: {
    ticks: createCallbackLogic(({ sendBack }) => {
      const interval = setInterval(() => {
        sendBack({ type: 'TICK' });
      }, 1000);

      return () => clearInterval(interval);
    })
  }
}).createMachine({
  id: 'timer',
  initial: 'stopped',
  context: {
    seconds: 0
  },
  states: {
    stopped: {
      on: {
        start: ({ context }) => {
          // Can only start a timer that has time on it
          if (context.seconds === 0) {
            return;
          }

          return { target: 'running' };
        },
        minute: ({ context }) => ({
          context: { ...context, seconds: context.seconds + 60 }
        }),
        second: ({ context }) => ({
          context: { ...context, seconds: context.seconds + 1 }
        })
      }
    },
    running: {
      invoke: {
        src: 'ticks'
      },
      on: {
        stop: { target: 'stopped' },
        TICK: ({ context }) => ({
          context: { ...context, seconds: context.seconds - 1 }
        })
      },
      always: ({ context }) => {
        if (context.seconds > 0) {
          return;
        }

        return { target: 'stopped' };
      }
    }
  },
  on: {
    reset: ({ context }) => {
      if (context.seconds === 0) {
        return;
      }

      return { context: { ...context, seconds: 0 } };
    }
  }
});
