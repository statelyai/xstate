import { Machine, sendParent, interpret, assign } from '../src';
import { respond, send } from '../src/actions';

describe('SCXML events', () => {
  it('should have the origin (id) from the sending machine service', (done) => {
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
            src: childMachine
          },
          on: {
            EVENT: {
              target: 'success',
              cond: (_: any, __: any, { _event }: any) => {
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

  it('should have the origin (id) from the sending callback service', () => {
    const machine = Machine<{ childOrigin?: string }>({
      initial: 'active',
      context: {},
      states: {
        active: {
          invoke: {
            id: 'callback_child',
            src: () => (send) => send({ type: 'EVENT' })
          },
          on: {
            EVENT: {
              target: 'success',
              actions: assign({
                childOrigin: (_, __, { _event }) => _event.origin
              })
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const service = interpret(machine).start();

    expect(service.state.context.childOrigin).toBe('callback_child');
  });

  it('respond() should be able to respond to sender', (done) => {
    const authServerMachine = Machine({
      initial: 'waitingForCode',
      states: {
        waitingForCode: {
          on: {
            CODE: {
              actions: respond('TOKEN', {
                delay: 10
              })
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
            src: authServerMachine
          },
          entry: send('CODE', {
            to: 'auth-server'
          }),
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

interface ChangePassword {
  type: 'changePassword';
  password: string;
}

const authMachine = Machine<SignInContext, ChangePassword>(
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
              cond: (_, event) => event.password.length >= 10,
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
