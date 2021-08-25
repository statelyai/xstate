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
          actions: friendModel.assign({ name: (_, event) => event.value })
        },
        SAVE: {
          target: 'saving'
        }
      }
    },
    saving: {
      tags: ['form', 'saving'],
      after: {
        // Simulate network request
        1000: {
          target: 'reading',
          actions: friendModel.assign({ prevName: (context) => context.name })
        }
      }
    }
  },
  on: {
    CANCEL: {
      actions: friendModel.assign({ name: (context) => context.prevName }),
      target: '.reading'
    }
  }
});
