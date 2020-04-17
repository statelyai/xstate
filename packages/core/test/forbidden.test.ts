import { Machine, assign } from '../src';

interface SignInContext {
  email: string;
  password: string;
}

type ChangePassword = {
  type: 'changePassword';
  password: string;
};

// Needed to put this in a variable to not get the "duplicated property" eslint
// warning
const changePassword = 'changePassword';

const authMachine = Machine<SignInContext>(
  {
    context: { email: '', password: '' },
    initial: 'passwordField',
    states: {
      passwordField: {
        initial: 'hidden',
        states: {
          hidden: {
            on: {
              // We don't want the password field to be revealed based on a
              // browser autocomplete firing an input `onChange` event.
              [changePassword]: undefined,
              // However, we do want to assign the value. Just prevent the
              // parent transitions
              [changePassword]: {
                actions: 'assignPassword'
              }
            }
          },
          valid: {},
          invalid: {}
        },
        on: {
          [changePassword]: [
            {
              cond: (_, event: ChangePassword) => event.password.length >= 10,
              target: '.invalid',
              actions: ['assignPassword']
            },
            {
              target: '.valid',
              actions: ['assignPassword']
            }
          ]
        }
      }
    }
  },
  {
    actions: {
      assignPassword: assign<SignInContext, ChangePassword>({
        password: (_, event) => event.password
      })
    }
  }
);

describe('forbidden event', () => {
  it('calls the assign action but prevents the parent state transitions', () => {
    // Why did I just commit my actual password? 🙊
    const password = 'xstate123';
    const state = authMachine.transition(authMachine.initialState, {
      type: changePassword,
      password
    });

    expect(state.value).toEqual({ passwordField: 'hidden' });
    expect(state.context).toEqual({ password, email: '' });
  });
});
