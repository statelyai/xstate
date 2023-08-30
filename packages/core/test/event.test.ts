import {
  createMachine,
  createActor,
  assign,
  AnyActorRef
} from '../src/index.ts';
import { sendTo } from '../src/actions/send';

describe('events', () => {
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

    const service = createActor(authClientMachine);
    service.subscribe({ complete: () => done() });
    service.start();

    service.send({ type: 'AUTH' });
  });
});

describe('nested transitions', () => {
  it('only take the transition of the most inner matching event', () => {
    interface SignInContext {
      email: string;
      password: string;
    }

    interface ChangePassword {
      type: 'changePassword';
      password: string;
    }

    const authMachine = createMachine(
      {
        types: {} as { context: SignInContext; events: ChangePassword },
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
          assignPassword: assign({
            password: ({ event }) => event.password
          })
        }
      }
    );
    const password = 'xstate123';
    const actorRef = createActor(authMachine).start();
    actorRef.send({ type: 'changePassword', password });

    const snapshot = actorRef.getSnapshot();
    expect(snapshot.value).toEqual({ passwordField: 'hidden' });
    expect(snapshot.context).toEqual({ password, email: '' });
  });
});
