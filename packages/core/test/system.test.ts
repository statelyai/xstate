import { of } from 'rxjs';
import { CallbackActorRef, fromCallback } from '../src/actors/callback.ts';
import {
  ActorRef,
  ActorSystem,
  assign,
  createMachine,
  fromEventObservable,
  fromObservable,
  fromPromise,
  fromTransition,
  createActor,
  sendTo,
  stopChild,
  Snapshot,
  EventObject,
  ActorRefFrom,
  spawnChild,
  AnyActorRef,
  AnyStateMachine
} from '../src/index.ts';

describe('system', () => {
  it('should register an invoked actor', (done) => {
    type MySystem = ActorSystem<{
      actors: {
        receiver: ActorRef<Snapshot<unknown>, { type: 'HELLO' }>;
      };
    }>;

    const machine = createMachine({
      id: 'parent',
      initial: 'a',
      states: {
        a: {
          invoke: [
            {
              src: fromCallback(({ receive }) => {
                receive((event) => {
                  expect(event.type).toBe('HELLO');
                  done();
                });
              }),
              systemId: 'receiver'
            },
            {
              src: createMachine({
                id: 'childmachine',
                entry: ({ system }) => {
                  const receiver = (system as MySystem)?.get('receiver');

                  if (receiver) {
                    receiver.send({ type: 'HELLO' });
                  }
                }
              })
            }
          ]
        }
      }
    });

    createActor(machine).start();
  });

  it('should register a spawned actor', (done) => {
    type MySystem = ActorSystem<{
      actors: {
        receiver: ActorRef<Snapshot<unknown>, { type: 'HELLO' }>;
      };
    }>;

    const machine = createMachine({
      types: {} as {
        context: {
          ref: CallbackActorRef<EventObject, unknown>;
          machineRef?: ActorRefFrom<AnyStateMachine>;
        };
      },
      id: 'parent',
      context: ({ spawn }) => ({
        ref: spawn(
          fromCallback(({ receive }) => {
            receive((event) => {
              expect(event.type).toBe('HELLO');
              done();
            });
          }),
          { systemId: 'receiver' }
        )
      }),
      on: {
        toggle: {
          actions: assign({
            machineRef: ({ spawn }) => {
              return spawn(
                createMachine({
                  id: 'childmachine',
                  entry: ({ system }) => {
                    const receiver = (system as MySystem)?.get('receiver');

                    if (receiver) {
                      receiver.send({ type: 'HELLO' });
                    } else {
                      throw new Error('no');
                    }
                  }
                })
              );
            }
          })
        }
      }
    });

    const actor = createActor(machine).start();

    actor.send({ type: 'toggle' });
  });

  it('system can be immediately accessed outside the actor', () => {
    const machine = createMachine({
      invoke: {
        systemId: 'someChild',
        src: createMachine({})
      }
    });

    // no .start() here is important for the test
    const actor = createActor(machine);

    expect(actor.system.get('someChild')).toBeDefined();
  });

  it('root actor can be given the systemId', () => {
    const machine = createMachine({});
    const actor = createActor(machine, { systemId: 'test' });
    expect(actor.system.get('test')).toBe(actor);
  });

  it('should remove invoked actor from receptionist if stopped', () => {
    const machine = createMachine({
      initial: 'active',
      states: {
        active: {
          invoke: {
            src: createMachine({}),
            systemId: 'test'
          },
          on: {
            toggle: 'inactive'
          }
        },
        inactive: {}
      }
    });

    const actor = createActor(machine).start();

    expect(actor.system.get('test')).toBeDefined();

    actor.send({ type: 'toggle' });

    expect(actor.system.get('test')).toBeUndefined();
  });

  it('should remove spawned actor from receptionist if stopped', () => {
    const childMachine = createMachine({});
    const machine = createMachine({
      types: {} as {
        context: {
          ref: ActorRefFrom<typeof childMachine>;
        };
      },
      context: ({ spawn }) => ({
        ref: spawn(childMachine, {
          systemId: 'test'
        })
      }),
      on: {
        toggle: {
          actions: stopChild(({ context }) => context.ref)
        }
      }
    });

    const actor = createActor(machine).start();

    expect(actor.system.get('test')).toBeDefined();

    actor.send({ type: 'toggle' });

    expect(actor.system.get('test')).toBeUndefined();
  });

  it('should throw an error if an actor with the system ID already exists', () => {
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            toggle: 'active'
          }
        },
        active: {
          invoke: [
            {
              src: createMachine({}),
              systemId: 'test'
            },
            {
              src: createMachine({}),
              systemId: 'test'
            }
          ]
        }
      }
    });

    const errorSpy = jest.fn();

    const actorRef = createActor(machine, { systemId: 'test' });
    actorRef.subscribe({
      error: errorSpy
    });
    actorRef.start();
    actorRef.send({ type: 'toggle' });

    expect(errorSpy).toMatchMockCallsInlineSnapshot(`
      [
        [
          [Error: Actor with system ID 'test' already exists.],
        ],
      ]
    `);
  });

  it('should cleanup stopped actors', () => {
    const machine = createMachine({
      types: {
        context: {} as {
          ref: AnyActorRef;
        }
      },
      context: ({ spawn }) => ({
        ref: spawn(
          fromPromise(() => Promise.resolve()),
          {
            systemId: 'test'
          }
        )
      }),
      on: {
        stop: {
          actions: stopChild(({ context }) => context.ref)
        },
        start: {
          actions: spawnChild(
            fromPromise(() => Promise.resolve()),
            {
              systemId: 'test'
            }
          )
        }
      }
    });

    const actor = createActor(machine).start();

    actor.send({ type: 'stop' });

    expect(() => {
      actor.send({ type: 'start' });
    }).not.toThrow();
  });

  it('should be accessible in inline custom actions', () => {
    const machine = createMachine({
      invoke: {
        src: createMachine({}),
        systemId: 'test'
      },
      entry: ({ system }) => {
        expect(system!.get('test')).toBeDefined();
      }
    });

    createActor(machine).start();
  });

  it('should be accessible in referenced custom actions', () => {
    const machine = createMachine(
      {
        invoke: {
          src: createMachine({}),
          systemId: 'test'
        },
        entry: 'myAction'
      },
      {
        actions: {
          myAction: ({ system }) => {
            expect(system!.get('test')).toBeDefined();
          }
        }
      }
    );

    createActor(machine).start();
  });

  it('should be accessible in assign actions', () => {
    const machine = createMachine({
      invoke: {
        src: createMachine({}),
        systemId: 'test'
      },
      initial: 'a',
      states: {
        a: {
          entry: assign(({ system }) => {
            expect(system!.get('test')).toBeDefined();
          })
        }
      }
    });

    createActor(machine).start();
  });

  it('should be accessible in sendTo actions', () => {
    const machine = createMachine({
      invoke: {
        src: createMachine({}),
        systemId: 'test'
      },
      initial: 'a',
      states: {
        a: {
          entry: sendTo(
            ({ system }) => {
              expect(system!.get('test')).toBeDefined();
              return system!.get('test');
            },
            { type: 'FOO' }
          )
        }
      }
    });

    createActor(machine).start();
  });

  it('should be accessible in promise logic', () => {
    expect.assertions(2);
    const machine = createMachine({
      invoke: [
        {
          src: createMachine({}),
          systemId: 'test'
        },
        {
          src: fromPromise(({ system }) => {
            expect(system.get('test')).toBeDefined();
            return Promise.resolve();
          })
        }
      ]
    });

    const actor = createActor(machine).start();

    expect(actor.system.get('test')).toBeDefined();
  });

  it('should be accessible in transition logic', () => {
    expect.assertions(2);
    const machine = createMachine({
      invoke: [
        {
          src: createMachine({}),
          systemId: 'test'
        },

        {
          src: fromTransition((_state, _event, { system }) => {
            expect(system.get('test')).toBeDefined();
            return 0;
          }, 0),
          systemId: 'reducer'
        }
      ]
    });

    const actor = createActor(machine).start();

    expect(actor.system.get('test')).toBeDefined();

    // The assertion won't be checked until the transition function gets an event
    actor.system.get('reducer')!.send({ type: 'a' });
  });

  it('should be accessible in observable logic', () => {
    expect.assertions(2);
    const machine = createMachine({
      invoke: [
        {
          src: createMachine({}),
          systemId: 'test'
        },

        {
          src: fromObservable(({ system }) => {
            expect(system.get('test')).toBeDefined();
            return of(0);
          })
        }
      ]
    });

    const actor = createActor(machine).start();

    expect(actor.system.get('test')).toBeDefined();
  });

  it('should be accessible in event observable logic', () => {
    expect.assertions(2);
    const machine = createMachine({
      invoke: [
        {
          src: createMachine({}),
          systemId: 'test'
        },

        {
          src: fromEventObservable(({ system }) => {
            expect(system.get('test')).toBeDefined();
            return of({ type: 'a' });
          })
        }
      ]
    });

    const actor = createActor(machine).start();

    expect(actor.system.get('test')).toBeDefined();
  });

  it('should be accessible in callback logic', () => {
    expect.assertions(2);
    const machine = createMachine({
      invoke: [
        {
          src: createMachine({}),
          systemId: 'test'
        },
        {
          src: fromCallback(({ system }) => {
            expect(system.get('test')).toBeDefined();
          })
        }
      ]
    });

    const actor = createActor(machine).start();

    expect(actor.system.get('test')).toBeDefined();
  });

  it('should gracefully handle re-registration of a `systemId` during a reentering transition', () => {
    const spy = jest.fn();

    let counter = 0;

    const machine = createMachine({
      initial: 'listening',
      states: {
        listening: {
          invoke: {
            systemId: 'listener',
            src: fromCallback(({ receive }) => {
              const localId = counter++;

              receive((event) => {
                spy(localId, event);
              });

              return () => {};
            })
          }
        }
      },
      on: {
        RESTART: {
          target: '.listening'
        }
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'RESTART' });
    actorRef.system.get('listener')!.send({ type: 'a' });

    expect(spy.mock.calls).toEqual([
      [
        1,
        {
          type: 'a'
        }
      ]
    ]);
  });

  it('should be able to send an event to an ancestor with a registered `systemId` from an initial entry action', () => {
    const spy = jest.fn();

    const child = createMachine({
      entry: sendTo(({ system }) => system.get('myRoot'), {
        type: 'EV'
      })
    });

    const machine = createMachine({
      invoke: {
        src: child
      },
      on: {
        EV: {
          actions: spy
        }
      }
    });
    createActor(machine, { systemId: 'myRoot' }).start();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
