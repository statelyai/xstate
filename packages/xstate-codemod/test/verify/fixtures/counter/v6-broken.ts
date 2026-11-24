import { createMachine, types } from 'xstate';

export const machine = createMachine({
  id: 'counter',
  schemas: {
    events: {
      INC: types<{ by: number }>(),
      DEC: types<{}>(),
      LOCK: types<{}>(),
      UNLOCK: types<{}>()
    }
  },
  initial: 'active',
  context: { count: 0 },
  states: {
    active: {
      on: {
        INC: ({ context, event }) => {
          if (context.count + event.by < 5) {
            return { context: { count: context.count + event.by } };
          }
        },
        DEC: ({ context }) => {
          if (context.count > 0) {
            return { context: { count: context.count - 1 } };
          }
        },
        LOCK: { target: 'locked' }
      }
    },
    locked: { on: { UNLOCK: { target: 'active' } } }
  }
});
