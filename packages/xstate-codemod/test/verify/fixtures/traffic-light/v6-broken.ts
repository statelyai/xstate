import { createMachine } from 'xstate';

export const machine = createMachine({
  id: 'light',
  initial: 'green',
  context: { cycles: 0 },
  states: {
    green: {
      after: { 1000: { target: 'yellow' } },
      on: { EMERGENCY: { target: 'red' } }
    },
    yellow: { after: { 500: { target: 'red' } } },
    red: {
      after: {
        2000: ({ context }) => ({
          target: 'green',
          context: { cycles: context.cycles + 2 }
        })
      }
    }
  }
});
