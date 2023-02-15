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
        type: 'submit';
        feedback: string;
      }
    | {
        type: 'close';
      }
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
        submit: {
          actions: assign({
            feedback: (_, event) => event.feedback
          }),
          target: 'thanks'
        }
      }
    },
    thanks: {},
    closed: {}
  },
  on: {
    close: 'closed'
  }
});
