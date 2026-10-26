// Fixture: a machine using a named guard where the ONLY mistake is a typo'd
// guard name in a choice state (`isRedy` instead of `isReady`).
import { createMachine } from 'xstate';

export const machine = createMachine({
  context: { ready: false },
  guards: {
    isReady: (ready: boolean) => ready
  },
  initial: 'routing',
  states: {
    routing: {
      type: 'choice',
      choice: ({ context, guards }) => ({
        target: guards.isRedy(context.ready) ? 'go' : 'wait'
      })
    },
    go: {},
    wait: {}
  }
});
