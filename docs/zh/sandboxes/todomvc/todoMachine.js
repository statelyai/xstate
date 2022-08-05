import { createMachine, assign } from 'xstate';

export const todoMachine = createMachine({
  id: 'todo',
  initial: 'reading',
  context: {
    id: undefined,
    title: '',
    prevTitle: ''
  },
  on: {
    TOGGLE_COMPLETE: {
      target: '.reading.completed',
      actions: [assign({ completed: true }), 'notifyChanged']
    },
    DELETE: 'deleted'
  },
  states: {
    reading: {
      initial: 'unknown',
      states: {
        unknown: {
          on: {
            '': [
              { target: 'completed', cond: (ctx) => ctx.completed },
              { target: 'pending' }
            ]
          }
        },
        pending: {},
        completed: {
          on: {
            TOGGLE_COMPLETE: {
              target: 'pending',
              actions: [assign({ completed: false }), 'notifyChanged']
            }
          }
        },
        hist: {
          type: 'history'
        }
      },
      on: {
        EDIT: {
          target: 'editing',
          actions: 'focusInput'
        }
      }
    },
    editing: {
      onEntry: assign({ prevTitle: (ctx) => ctx.title }),
      on: {
        CHANGE: {
          actions: assign({
            title: (ctx, e) => e.value
          })
        },
        COMMIT: [
          {
            target: 'reading.hist',
            actions: 'notifyChanged',
            cond: (ctx) => ctx.title.trim().length > 0
          },
          { target: 'deleted' }
        ],
        BLUR: {
          target: 'reading',
          actions: 'notifyChanged'
        },
        CANCEL: {
          target: 'reading',
          actions: assign({ title: (ctx) => ctx.prevTitle })
        }
      }
    },
    deleted: {
      onEntry: 'notifyDeleted'
    }
  }
});
