import { setup, types, createAsyncLogic } from 'xstate';

const TAKEN = ['ada', 'grace', 'alan'];

function isEmail(value: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

/**
 * Mock availability check. `signal` is aborted when the actor is stopped, which
 * happens as soon as the user types again — that is how stale responses are
 * cancelled.
 */
const checkUsername = createAsyncLogic({
  schemas: { input: types<{ username: string }>() },
  run: ({ input, signal }): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => resolve(!TAKEN.includes(input.username.toLowerCase())),
        900
      );

      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new Error('Check cancelled.'));
      });
    })
});

type FormContext = {
  username: string;
  email: string;
};

export const formMachine = setup({
  schemas: {
    context: types<FormContext>(),
    events: {
      changeUsername: types<{ value: string }>(),
      changeEmail: types<{ value: string }>()
    }
  },
  actors: { checkUsername },
  delays: { debounce: 400 }
}).createMachine({
  id: 'form',
  context: { username: '', email: '' },
  type: 'parallel',
  states: {
    username: {
      initial: 'pristine',
      on: {
        changeUsername: ({ event }) =>
          event.value
            ? {
                // External self-transition: re-entering `debouncing` restarts
                // the delay and stops any in-flight check.
                target: '.debouncing',
                context: { username: event.value }
              }
            : { target: '.pristine', context: { username: '' } }
      },
      states: {
        pristine: {},
        debouncing: {
          after: { debounce: { target: 'checking' } }
        },
        checking: {
          invoke: {
            src: 'checkUsername',
            input: ({ context }) => ({ username: context.username }),
            onDone: ({ event }) => ({
              target: event.output ? 'available' : 'taken'
            })
          }
        },
        available: {},
        taken: {}
      }
    },
    email: {
      initial: 'pristine',
      on: {
        changeEmail: ({ event }) => ({
          target: !event.value
            ? '.pristine'
            : isEmail(event.value)
              ? '.valid'
              : '.invalid',
          context: { email: event.value }
        })
      },
      states: {
        pristine: {},
        valid: {},
        invalid: {}
      }
    }
  }
});
