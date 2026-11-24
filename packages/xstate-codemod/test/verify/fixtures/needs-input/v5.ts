// oxlint-disable-next-line typescript/ban-ts-comment
// @ts-nocheck: loaded under xstate@5 by the verify child; typechecked as v6 here.
import { assign, createMachine } from 'xstate';

export const machine = createMachine({
  id: 'needsInput',
  initial: 'idle',
  context: ({ input }) => ({ count: input.start }),
  states: {
    idle: { on: { NEXT: 'counting' } },
    counting: {
      on: {
        INC: { actions: assign({ count: ({ context }) => context.count + 1 }) },
        NEXT: 'paused'
      }
    },
    paused: { on: { NEXT: 'counting', FINISH: 'done' } },
    done: { type: 'final' }
  }
});
