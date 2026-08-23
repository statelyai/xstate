import { createCallbackLogic, setup, types } from 'xstate';

/** Milliseconds between ticks. */
const TICK_MS = 100;

/** Duration slider bounds, in milliseconds. */
export const MIN_DURATION = 0;
export const MAX_DURATION = 30_000;

interface TimerContext {
  /** Elapsed time in milliseconds. Never reset by a duration change. */
  elapsed: number;
  /** Target duration in milliseconds. */
  duration: number;
}

export const timerMachine = setup({
  schemas: {
    context: types<TimerContext>(),
    events: {
      setDuration: types<{ duration: number }>(),
      reset: types<{}>(),
      TICK: types<{}>()
    }
  },
  actors: {
    ticks: createCallbackLogic(({ sendBack }) => {
      const interval = setInterval(() => sendBack({ type: 'TICK' }), TICK_MS);

      return () => clearInterval(interval);
    })
  },
  guards: {
    // Standalone, args-first: the rule only needs the two numbers it compares.
    isElapsed: ({ elapsed, duration }: TimerContext) => elapsed >= duration
  }
}).createMachine({
  id: 'timer',
  context: {
    elapsed: 0,
    duration: 10_000
  },
  initial: 'running',
  states: {
    // The ticker only exists while this state is active, so no timer runs
    // once the duration is reached.
    running: {
      invoke: { src: 'ticks' },
      always: ({ context, guards }) =>
        guards.isElapsed(context) ? { target: 'done' } : undefined,
      on: {
        TICK: ({ context }) => ({
          context: {
            elapsed: Math.min(context.elapsed + TICK_MS, context.duration)
          }
        })
      }
    },
    done: {}
  },
  on: {
    // Elapsed time is preserved. Raising the duration above the elapsed time
    // re-enters `running`, which re-arms the ticker; lowering it below the
    // elapsed time falls through to `done` via `always`.
    setDuration: ({ event }) => ({
      target: '.running',
      reenter: true,
      context: { duration: event.duration }
    }),
    reset: {
      target: '.running',
      reenter: true,
      context: { elapsed: 0 }
    }
  }
});
