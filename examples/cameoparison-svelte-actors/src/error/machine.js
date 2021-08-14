import { createMachine, sendParent } from 'xstate';

export const errorMachine = (targetState) =>
  createMachine({
    id: 'errorActor',
    context: {
      targetState: targetState
    },

    initial: 'idle',
    states: {
      idle: {
        on: {
          retry: {
            actions: sendParent((context, event) => ({
              type: 'retry',
              targetState: context.targetState
            }))
          }
        }
      }
    }
  });
