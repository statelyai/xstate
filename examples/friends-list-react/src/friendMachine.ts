import { types, createMachine, createAsyncLogic } from 'xstate';

export const friendMachine = createMachine({
  schemas: {
    context: types<{ prevName: string; name: string }>(),
    events: {
      SET_NAME: types<{ value: string }>(),
      SAVE: types<{}>(),
      EDIT: types<{}>(),
      CANCEL: types<{}>()
    },
    input: types<{ name: string }>(),
    tags: types<'read' | 'form' | 'saving'>()
  },
  actors: {
    saveUser: createAsyncLogic({
      run: async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return true;
      }
    })
  },
  initial: 'reading',
  context: ({ input }) => ({ prevName: input.name, name: input.name }),
  states: {
    reading: { tags: ['read'], on: { EDIT: { target: 'editing' } } },
    editing: {
      tags: ['form'],
      on: {
        SET_NAME: ({ context, event }) => ({
          context: { ...context, name: event.value }
        }),
        SAVE: { target: 'saving' }
      }
    },
    saving: {
      tags: ['form', 'saving'],
      invoke: {
        src: 'saveUser',
        onDone: ({ context }) => ({
          target: 'reading',
          context: { ...context, prevName: context.name }
        }),
        onError: { target: 'editing' }
      }
    }
  },
  on: {
    CANCEL: ({ context }) => ({
      target: '.reading',
      context: { ...context, name: context.prevName }
    })
  }
});
