// Fixture: a machine using a named guard where the ONLY mistake is a typo'd
// guard name in a choice state (`isRedy` instead of `isReady`).
import { createMachine } from 'xstate';

export const machine = createMachine({
  context: { ready: false },
  guards: {
    isReady: ({ context }) => context.ready === true
  },
  initial: 'routing',
  states: {
    routing: {
      type: 'choice',
      choices: [{ guard: { type: 'isRedy' }, target: 'go' }, { target: 'wait' }]
    },
    go: {},
    wait: {}
  }
});
