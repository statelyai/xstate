import { types, createMachine, createCallbackLogic } from 'xstate';

export const stopwatchMachine = createMachine({
  schemas: {
    events: {
      start: types<{}>(),
      stop: types<{}>(),
      reset: types<{}>(),
      TICK: types<{}>()
    }
  },
  actors: {
    ticks: createCallbackLogic(({ sendBack }) => {
      const interval = setInterval(() => sendBack({ type: 'TICK' }), 10);
      return () => clearInterval(interval);
    })
  },
  id: 'stopwatch',
  initial: 'stopped',
  context: { elapsed: 0 },
  states: {
    stopped: { on: { start: { target: 'running' } } },
    running: {
      invoke: { src: 'ticks' },
      on: {
        TICK: ({ context }) => ({ context: { elapsed: context.elapsed + 1 } }),
        stop: { target: 'stopped' }
      }
    }
  },
  on: { reset: () => ({ target: '.stopped', context: { elapsed: 0 } }) }
});
