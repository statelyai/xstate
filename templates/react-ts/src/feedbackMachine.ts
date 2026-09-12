import { createMachine, types } from 'xstate';

export const feedbackMachine = createMachine({
  schemas: {
    events: {
      'feedback.good': types<{}>(),
      'feedback.bad': types<{}>(),
      'feedback.update': types<{ value: string }>(),
      submit: types<{}>(),
      close: types<{}>(),
      back: types<{}>(),
      restart: types<{}>()
    }
  },
  id: 'feedback',
  initial: 'prompt',
  context: { feedback: '' },
  states: {
    prompt: {
      on: {
        'feedback.good': { target: 'thanks' },
        'feedback.bad': { target: 'form' }
      }
    },
    form: {
      on: {
        'feedback.update': ({ context, event }) => ({
          context: { ...context, feedback: event.value }
        }),
        back: { target: 'prompt' },
        submit: ({ context }) => {
          if (context.feedback.length > 0) return { target: 'thanks' };
          return;
        }
      }
    },
    thanks: {},
    closed: {
      on: {
        restart: ({ context }) => ({
          target: 'prompt',
          context: { ...context, feedback: '' }
        })
      }
    }
  },
  on: { close: { target: '.closed' } }
});
