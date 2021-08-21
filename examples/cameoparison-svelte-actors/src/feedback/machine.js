import { createMachine, sendParent } from 'xstate';

export const feedbackMachine = (results) =>
  createMachine({
    id: 'feedbackActor',
    context: {
      results: results
    },

    on: {
      RESTART: {
        actions: sendParent('RESTART')
      }
    }
  });
