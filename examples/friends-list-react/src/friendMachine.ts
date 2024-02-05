import { assign, fromPromise, setup } from 'xstate';

export const friendMachine = setup({
  types: {
    context: {} as {
      prevName: string;
      name: string;
    },
    events: {} as
      | {
          type: 'SET_NAME';
          value: string;
        }
      | {
          type: 'SAVE';
        }
      | {
          type: 'EDIT';
        }
      | {
          type: 'CANCEL';
        },
    input: {} as {
      name: string;
    },
    tags: {} as 'read' | 'form' | 'saving'
  },
  actors: {
    saveUser: fromPromise(async () => {
      // Simulate network request
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return true;
    })
  }
}).createMachine({
  id: 'friend',

  initial: 'reading',
  context: ({ input }) => ({
    prevName: input.name,
    name: input.name
  }),
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
          actions: assign({ name: ({ event }) => event.value })
        },
        SAVE: {
          target: 'saving'
        }
      }
    },
    saving: {
      tags: ['form', 'saving'],
      invoke: {
        src: 'saveUser',
        onDone: {
          target: 'reading',
          actions: assign({ prevName: ({ context }) => context.name })
        }
      }
    }
  },
  on: {
    CANCEL: {
      actions: assign({ name: ({ context }) => context.prevName }),
      target: '.reading'
    }
  }
});
