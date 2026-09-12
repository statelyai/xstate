import { setup, types } from 'xstate';

export const feedbackMachine = setup({
  schemas: {
    context: types<{ feedback: string }>(),
    events: {
      'feedback.good': types<{}>(),
      'feedback.bad': types<{}>(),
      'feedback.update': types<{ value: string }>(),
      submit: types<{}>(),
      close: types<{}>(),
      back: types<{}>(),
      restart: types<{}>()
    }
  }
}).createMachine({
  id: 'feedback',
  initial: 'prompt',
  context: {
    feedback: ''
  },
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
          // Only submit when feedback has been provided
          if (context.feedback.length === 0) {
            return;
          }

          return { target: 'thanks' };
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
  on: {
    close: { target: '.closed' }
  }
});
