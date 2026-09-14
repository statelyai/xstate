import { createCallbackLogic, setup, types } from 'xstate';

export const stopwatchMachine = setup({
  schemas: {
    context: types<{ elapsed: number }>(),
    events: {
      start: types<{}>(),
      stop: types<{}>(),
      reset: types<{}>(),
      TICK: types<{}>()
    }
  },
  actors: {
    ticks: createCallbackLogic(({ sendBack }) => {
      const interval = setInterval(() => {
        sendBack({ type: 'TICK' });
      }, 10);

      return () => clearInterval(interval);
    })
  }
}).createMachine({
  id: 'stopwatch',
  initial: 'stopped',
  context: {
    elapsed: 0
  },
  states: {
    stopped: {
      on: {
        start: { target: 'running' }
      }
    },
    running: {
      invoke: {
        src: 'ticks'
      },
      on: {
        TICK: ({ context }) => ({
          context: { ...context, elapsed: context.elapsed + 1 }
        }),
        stop: { target: 'stopped' }
      }
    }
  },
  on: {
    reset: ({ context }) => ({
      target: '.stopped',
      context: { ...context, elapsed: 0 }
    })
  }
});
