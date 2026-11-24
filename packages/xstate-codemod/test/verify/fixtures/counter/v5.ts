// oxlint-disable-next-line typescript/ban-ts-comment
// @ts-nocheck: loaded under xstate@5 by the verify child; typechecked as v6 here.
import { assign, setup } from 'xstate';

export const machine = setup({
  guards: {
    canIncrement: ({ context, event }) => context.count + event.by <= 5,
    canDecrement: ({ context }) => context.count > 0
  }
}).createMachine({
  id: 'counter',
  initial: 'active',
  context: { count: 0 },
  states: {
    active: {
      on: {
        INC: {
          guard: 'canIncrement',
          actions: assign({
            count: ({ context, event }) => context.count + event.by
          })
        },
        DEC: {
          guard: 'canDecrement',
          actions: assign({ count: ({ context }) => context.count - 1 })
        },
        LOCK: 'locked'
      }
    },
    locked: { on: { UNLOCK: 'active' } }
  }
});
