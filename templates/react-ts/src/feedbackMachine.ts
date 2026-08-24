import { createMachine } from 'xstate';

export const feedbackMachine = createMachine({
  types: {
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
  },
  guards: {
    feedbackValid: ({ context }) => context.feedback.length > 0
  },
  id: 'feedback',
  initial: 'prompt',
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
        'feedback.update': ({ context, event, guards, actions }, enq) => {
          return {
            context: {
              ...context,
              feedback: (({ event }) => event.value)({
                context: context,
                event: event
              })
            }
          };
        },
        back: { target: 'prompt' },
        submit: ({ context, event, guards, actions }, enq) => {
          if (!guards['feedbackValid']({ context, event })) {
            return;
          }
          return { target: 'thanks' };
        }
      }
    },
    thanks: {},
    closed: {
      on: {
        restart: ({ context, event, guards, actions }, enq) => {
          return { target: 'prompt', context: { ...context, feedback: '' } };
        }
      }
    }
  },
  on: {
    close: '.closed'
  }
});
