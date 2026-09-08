import { types, createMachine, createCallbackLogic } from 'xstate';

export const timerMachine = createMachine({
  schemas: {
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
      const interval = setInterval(() => sendBack({ type: 'TICK' }), 1000);
      return () => clearInterval(interval);
    })
  },
  context: { seconds: 0 },
  initial: 'stopped',
  states: {
    stopped: {
      on: {
        start: ({ context }) =>
          context.seconds > 0 ? { target: 'running' } : undefined,
        minute: ({ context }) => ({
          context: { seconds: context.seconds + 60 }
        }),
        second: ({ context }) => ({ context: { seconds: context.seconds + 1 } })
      }
    },
    running: {
      invoke: { src: 'ticks' },
      on: {
        stop: { target: 'stopped' },
        TICK: ({ context }) => ({ context: { seconds: context.seconds - 1 } })
      },
      always: ({ context }) =>
        context.seconds === 0 ? { target: 'stopped' } : undefined
    }
  },
  on: {
    reset: ({ context }) =>
      context.seconds > 0 ? { context: { seconds: 0 } } : undefined
  }
});
