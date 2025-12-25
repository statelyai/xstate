import { setup, assign } from 'xstate';

/*
 * This state machine represents a simple counter that can be incremented, decremented, and toggled on and off.
 * The counter starts in the "enabled" state, where it can be incremented or decremented.
 * If the counter reaches its maximum value, it cannot be incremented further. Similarly, if the counter reaches its minimum value, it cannot be decremented further. The counter can also be toggled to the "disabled" state, where it cannot be incremented or decremented.
 * Toggling it again will bring it back to the "enabled" state.
 */

export const counterMachine = setup({
  types: {
    context: {} as { counter: number; event: unknown },
    events: {} as
      | {
          type: 'INC';
        }
      | {
          type: 'DEC';
        }
      | {
          type: 'TOGGLE';
        }
  },
  actions: {
    increment: assign({
      counter: ({ context }) => context.counter + 1,
      event: ({ event }) => event
    }),
    decrement: assign({
      counter: ({ context }) => context.counter - 1,
      event: ({ event }) => event
    })
  },
  guards: {
    isNotMax: ({ context }) => context.counter < 10,
    isNotMin: ({ context }) => context.counter > 0
  }
}).createMachine({
  id: 'counter',
  context: { counter: 0, event: undefined },
  initial: 'enabled',
  states: {
    enabled: {
      on: {
        INC: {
          actions: {
            type: 'increment'
          },
          guard: {
            type: 'isNotMax'
          }
        },
        DEC: {
          actions: {
            type: 'decrement'
          },
          guard: {
            type: 'isNotMin'
          }
        },
        TOGGLE: {
          target: 'disabled'
        }
      }
    },
    disabled: {
      on: {
        TOGGLE: {
          target: 'enabled'
        }
      }
    }
  }
});
