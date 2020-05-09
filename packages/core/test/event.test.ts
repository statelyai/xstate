import { Machine, sendParent, interpret, assign } from '../src';
import { respond, send } from '../src/actions';
import { spawnMachine } from '../src/invoke';

describe('SCXML events', () => {
  it('should have the origin (id) from the sending service', (done) => {
    const childMachine = Machine({
      initial: 'active',
      states: {
        active: {
          entry: sendParent('EVENT')
        }
      }
    });

    const parentMachine = Machine({
      initial: 'active',
      states: {
        active: {
          invoke: {
            id: 'child',
            src: spawnMachine(childMachine)
          },
          on: {
            EVENT: {
              target: 'success',
              cond: (_, __, { _event }) => {
                return !!(_event.origin && _event.origin.length > 0);
              }
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    interpret(parentMachine)
      .onDone(() => done())
      .start();
  });

  it('respond() should be able to respond to sender', (done) => {
    const authServerMachine = Machine({
      initial: 'waitingForCode',
      states: {
        waitingForCode: {
          on: {
            CODE: {
              actions: respond('TOKEN', { delay: 10 })
            }
          }
        }
      }
    });

    const authClientMachine = Machine({
      initial: 'idle',
      states: {
        idle: {
          on: { AUTH: 'authorizing' }
        },
        authorizing: {
          invoke: {
            id: 'auth-server',
            src: spawnMachine(authServerMachine)
          },
          entry: send('CODE', { to: 'auth-server' }),
          on: {
            TOKEN: 'authorized'
          }
        },
        authorized: {
          type: 'final'
        }
      }
    });

    const service = interpret(authClientMachine)
      .onDone(() => done())
      .start();

    service.send('AUTH');
  });
});

interface SignInContext {
  email: string;
  password: string;
}

type ChangePassword = {
  type: 'changePassword';
  password: string;
};

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
              // We want to assign the new password but remain in the hidden
              // state
              changePassword: {
                actions: 'assignPassword'
              }
            }
          },
          valid: {},
          invalid: {}
        },
        on: {
          changePassword: [
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

describe('nested transitions', () => {
  it('only take the transition of the most inner matching event', () => {
    const password = 'xstate123';
    const state = authMachine.transition(authMachine.initialState, {
      type: 'changePassword',
      password
    });

    expect(state.value).toEqual({ passwordField: 'hidden' });
    expect(state.context).toEqual({ password, email: '' });
  });
});
