import { createMachine, createAsyncLogic } from 'xstate';
export const friendMachine = createMachine({
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
  actorSources: {
    saveUser: createAsyncLogic({
      run: async () => {
        // Simulate network request
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return true;
      }
    })
  },
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
        SET_NAME: ({ context, event, guards, actions }, enq) => {
          return {
            context: {
              ...context,
              name: (({ event }) => event.value)({
                context: context,
                event: event
              })
            }
          };
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
        onDone: ({ context, event, guards, actions }, enq) => {
          return {
            target: 'reading',
            context: {
              ...context,
              prevName: (({ context }) => context.name)({
                context: context,
                event: event
              })
            }
          };
        }
      }
    }
  },
  on: {
    CANCEL: ({ context, event, guards, actions }, enq) => {
      return {
        target: '.reading',
        context: {
          ...context,
          name: (({ context }) => context.prevName)({
            context: context,
            event: event
          })
        }
      };
    }
  }
});
