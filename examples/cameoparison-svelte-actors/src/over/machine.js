import { createMachine, sendParent } from 'xstate';

export const overMachine = (results) =>
  createMachine({
    id: 'overActor',
    context: {
      results: results
    },

    initial: 'idle',
    states: {
      idle: {
        on: {
          restart: {
            actions: sendParent((context, event) => ({
              type: 'restart',
              results: context.results
            }))
          }
        }
      }
    }
  });
