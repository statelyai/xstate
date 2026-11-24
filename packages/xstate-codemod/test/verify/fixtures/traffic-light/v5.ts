// oxlint-disable-next-line typescript/ban-ts-comment
// @ts-nocheck: loaded under xstate@5 by the verify child; typechecked as v6 here.
import { assign, createMachine } from 'xstate';

export const machine = createMachine({
  id: 'light',
  initial: 'green',
  context: { cycles: 0 },
  states: {
    green: { after: { 1000: 'yellow' }, on: { EMERGENCY: 'red' } },
    yellow: { after: { 500: 'red' } },
    red: {
      after: {
        2000: {
          target: 'green',
          actions: assign({ cycles: ({ context }) => context.cycles + 1 })
        }
      }
    }
  }
});
