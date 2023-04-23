import {
  createMachine,
  sendParent,
  interpret,
  assign,
  AnyActorRef
} from '../src/index.ts';
import { respond } from '../src/actions';
import { sendTo } from '../src/actions/send';
import { fromCallback } from '../src/actors/callback';

describe('SCXML events', () => {
  it('should have the origin (id) from the sending machine service', (done) => {
    const childMachine = createMachine({
      initial: 'active',
      states: {
        active: {
          entry: sendParent({ type: 'EVENT' })
        }
      }
    });

    const parentMachine = createMachine({
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
              guard: ({ _event }) => {
                return !!_event.origin;
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

  it('should have the origin (id) from the sending callback service', (done) => {
    const machine = createMachine<{ childOrigin?: string }>({
      initial: 'active',
      context: {},
      states: {
        active: {
          invoke: {
            id: 'callback_child',
            src: fromCallback((sendBack) => sendBack({ type: 'EVENT' }))
          },
          on: {
            EVENT: {
              target: 'success',
              actions: assign({
                childOrigin: ({ _event }) => {
                  return _event.origin?.id;
                }
              })
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const actor = interpret(machine);
    actor.subscribe((state) => {
      if (state.done) {
        expect(state.context.childOrigin).toEqual('callback_child');
        done();
      }
    });
    actor.start();
  });

  it('respond() should be able to respond to sender', (done) => {
    const authServerMachine = createMachine({
      id: 'authServer',
      initial: 'waitingForCode',
      states: {
        waitingForCode: {
          on: {
            CODE: {
              actions: respond(
                { type: 'TOKEN' },
                {
                  delay: 10
                }
              )
            }
          }
        }
      }
    });

    const authClientMachine = createMachine({
      id: 'authClient',
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
          entry: sendTo('auth-server', { type: 'CODE' }),
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

    service.send({ type: 'AUTH' });
  });

  it('should be able to respond to sender by sending self', (done) => {
    const authServerMachine = createMachine({
      types: {
        events: {} as { type: 'CODE'; sender: AnyActorRef }
      },
      id: 'authServer',
      initial: 'waitingForCode',
      states: {
        waitingForCode: {
          on: {
            CODE: {
              actions: sendTo(
                ({ event }) => {
                  expect(event.sender).toBeDefined();
                  return event.sender;
                },
                { type: 'TOKEN' },
                { delay: 10 }
              )
            }
          }
        }
      }
    });

    const authClientMachine = createMachine({
      id: 'authClient',
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
          entry: sendTo('auth-server', ({ self }) => ({
            type: 'CODE',
            sender: self
          })),
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

    service.send({ type: 'AUTH' });
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

const authMachine = createMachine<SignInContext, ChangePassword>(
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
              guard: ({ event }) => event.password.length >= 10,
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
        password: ({ event }) => event.password
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
