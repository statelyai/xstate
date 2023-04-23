import { assign, createMachine } from 'xstate';

const types = {
  context: {} as { feedback: string },
  events: {} as
    | {
        type: 'feedback.good';
      }
    | {
        type: 'feedback.bad';
      }
    | {
        type: 'feedback.update';
        value: string;
      }
    | { type: 'submit' }
    | {
        type: 'close';
      }
    | { type: 'back' }
    | { type: 'restart' }
};

export const feedbackMachine = createMachine({
  id: 'feedback',
  initial: 'prompt',
  types,
  context: {
    feedback: ''
  },
  states: {
    prompt: {
      on: {
        'feedback.good': 'thanks',
        'feedback.bad': 'form'
      }
    },
    form: {
      on: {
        'feedback.update': {
          actions: assign({
            feedback: ({ event }) => event.value
          })
        },
        back: { target: 'prompt' },
        submit: {
          guard: ({ context }) => context.feedback.length > 0,
          target: 'thanks'
        }
      }
    },
    thanks: {},
    closed: {
      on: {
        restart: 'prompt'
      }
    }
  },
  on: {
    close: '.closed'
  }
});
