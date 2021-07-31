import { assign } from 'xstate';
import { createModel } from 'xstate/lib/model';

const friendModel = createModel(
  {
    prevName: '',
    name: ''
  },
  {
    events: {
      SET_NAME: (value: string) => ({ value }),
      SAVE: () => ({}),
      EDIT: () => ({}),
      CANCEL: () => ({})
    }
  }
);

export const friendMachine = friendModel.createMachine({
  context: {
    prevName: '',
    name: ''
  },
  initial: 'reading',
  states: {
    reading: {
      tags: 'read',
      on: {
        EDIT: 'editing'
      }
    },
    editing: {
      tags: 'form',
      on: {
        SET_NAME: {
          actions: assign({ name: (_, e) => e.value })
        },
        SAVE: {
          target: 'saving'
        }
      }
    },
    saving: {
      tags: ['form', 'saving'],
      entry: (ctx) => console.log(ctx),
      after: {
        1000: {
          target: 'reading',
          actions: assign({ prevName: (ctx) => ctx.name })
        }
      }
    }
  },
  on: {
    CANCEL: {
      actions: assign({ name: (ctx) => ctx.prevName }),
      target: '.reading'
    }
  }
});
