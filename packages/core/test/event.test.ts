import { z } from 'zod';
import { createMachine, createActor, AnyActorRef } from '../src/index.ts';

describe('events', () => {
  it('should be able to respond to sender by sending self', async () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const authServerMachine = createMachine({
      // types: {
      //   events: {} as { type: 'CODE'; sender: AnyActorRef }
      // },
      schemas: {
        events: z.object({
          type: z.literal('CODE'),
          sender: z.any() // TODO: AnyActorRef
        })
      },
      id: 'authServer',
      initial: 'waitingForCode',
      states: {
        waitingForCode: {
          on: {
            CODE: ({ event }, enq) => {
              expect(event.sender).toBeDefined();

              enq(() => {
                setTimeout(() => {
                  event.sender.send({ type: 'TOKEN' });
                }, 10);
              });
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
          entry: ({ children, self }) => {
            children['auth-server']?.send({
              type: 'CODE',
              sender: self
            });
          },
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
    service.subscribe({ complete: () => resolve() });
    service.start();

    service.send({ type: 'AUTH' });

    return promise;
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

    const assignPassword = (
      context: SignInContext,
      password: string
    ): SignInContext => ({
      ...context,
      password
    });

    const authMachine = createMachine({
      // types: {} as { context: SignInContext; events: ChangePassword },
      schemas: {
        context: z.object({
          email: z.string(),
          password: z.string()
        }),
        events: z.object({
          type: z.literal('changePassword'),
          password: z.string()
        })
      },
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
                changePassword: ({ context, event }) => ({
                  context: assignPassword(context, event.password)
                })
              }
            },
            valid: {},
            invalid: {}
          },
          on: {
            changePassword: ({ context, event }, enq) => {
              const ctx = assignPassword(context, event.password);
              if (event.password.length >= 10) {
                return {
                  target: '.invalid',
                  context: ctx
                };
              }

              return {
                target: '.valid',
                context: ctx
              };
            }
          }
        }
      }
    });
    const password = 'xstate123';
    const actorRef = createActor(authMachine).start();
    actorRef.send({ type: 'changePassword', password });

    const snapshot = actorRef.getSnapshot();
    expect(snapshot.value).toEqual({ passwordField: 'hidden' });
    expect(snapshot.context).toEqual({ password, email: '' });
  });
});
