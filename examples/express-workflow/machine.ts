import { setup, types } from 'xstate';

export const machine = setup({
  schemas: {
    context: types<{ cycles: number }>(),
    events: {
      TIMER: types<{}>()
    }
  }
}).createMachine({
  id: 'trafficLight',
  initial: 'green',
  context: { cycles: 0 },
  states: {
    green: {
      on: { TIMER: { target: 'yellow' } }
    },
    yellow: {
      on: { TIMER: { target: 'red' } }
    },
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
