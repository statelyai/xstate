import { createMachine } from 'xstate';

export const machine = createMachine({
  id: 'stamp',
  initial: 'idle',
  context: () => ({
    startedAt: Date.now(),
    stamps: [] as Array<{ at: number; perf: number; r: number }>
  }),
  states: {
    idle: {
      after: { 1000: { target: 'waiting' } },
      on: {
        STAMP: ({ context }) => ({
          context: {
            ...context,
            stamps: [
              ...context.stamps,
              { at: Date.now(), perf: performance.now(), r: Math.random() }
            ]
          }
        })
      }
    },
    waiting: { on: { STAMP: { target: 'idle' } } }
  }
});
