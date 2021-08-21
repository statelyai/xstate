import { createMachine, sendParent } from 'xstate';

export const feedbackMachine = (results) =>
  createMachine({
    id: 'feedbackActor',
    context: {
      results: results
    },

    initial: 'idle',
    states: {
      idle: {
        on: {
          RESTART: {
            actions: sendParent('RESTART')
          }
        }
      }
    }
  });
