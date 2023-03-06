import { assign, createMachine } from 'xstate';

const schema = {
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
  schema,
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
            feedback: (_, event) => event.value
          })
        },
        back: { target: 'prompt' },
        submit: {
          cond: (ctx) => ctx.feedback.length > 0,
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
    close: 'closed'
  }
});
