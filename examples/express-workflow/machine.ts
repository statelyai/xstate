import { createMachine } from 'xstate';

export const machine = createMachine({
  id: 'counter',
  initial: 'green',
  context: { cycles: 0 },
  states: {
    green: { on: { TIMER: { target: 'yellow' } } },
    yellow: { on: { TIMER: { target: 'red' } } },
    red: {
      on: {
        TIMER: ({ context }) => ({
          target: 'green',
          context: { ...context, cycles: context.cycles + 1 }
        })
      }
    }
  }
});
