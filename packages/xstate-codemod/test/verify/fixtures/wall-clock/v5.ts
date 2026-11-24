// oxlint-disable-next-line typescript/ban-ts-comment
// @ts-nocheck: loaded under xstate@5 by the verify child; typechecked as v6 here.
import { assign, createMachine } from 'xstate';

export const machine = createMachine({
  id: 'stamp',
  initial: 'idle',
  context: () => ({ startedAt: Date.now(), stamps: [] }),
  states: {
    idle: {
      after: { 1000: 'waiting' },
      on: {
        STAMP: {
          actions: assign({
            stamps: ({ context }) => [
              ...context.stamps,
              { at: Date.now(), perf: performance.now(), r: Math.random() }
            ]
          })
        }
      }
    },
    waiting: { on: { STAMP: 'idle' } }
  }
});
