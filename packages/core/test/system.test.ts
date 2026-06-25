import { of } from 'rxjs';
import { z } from 'zod';
import { createCallbackLogic } from '../src/actors/callback.ts';
import {
  ActorRef,
  Snapshot,
  createActor,
  createLogic,
  createMachine,
  createSystem,
  createEventObservableLogic,
  createObservableLogic,
  createAsyncLogic
} from '../src/index.ts';
import { ActorSystem } from '../src/system.ts';

describe('system', () => {
  it('should register an invoked actor', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
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
              src: createCallbackLogic(({ receive }) => {
                receive((event) => {
                  expect(event.type).toBe('HELLO');
                  resolve();
                });
              }),
              registryKey: 'receiver'
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

    return promise;
  });

  it('should register an invoked actor with a registryKey', () => {
    const machine = createMachine({
      id: 'parent',
      invoke: {
        src: createMachine({}),
        registryKey: 'receiver'
      }
    });

    const actor = createActor(machine);

    expect(actor.system.get('receiver')).toBeDefined();
  });

  it('createSystem should own the runtime actor system', () => {
    const child = createMachine({});
    const machine = createMachine({
      invoke: {
        src: child,
        registryKey: 'receiver'
      }
    });
    const system = createSystem({
      registry: {
        root: machine,
        receiver: child
      }
    });

    expect(system.get('root')).toBeUndefined();

    const actor = system.createActor(machine, { registryKey: 'root' });

    expect(system.get('root')).toBe(actor);
    expect(system.get('receiver')).toBe(actor.system.get('receiver'));
    expect(system.getAll()).toEqual(actor.system.getAll());
  });

  it('transition functions can access the actor system', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const receiver = createCallbackLogic<{ type: 'HELLO' }>(({ receive }) => {
      receive((event) => {
        if (event.type === 'HELLO') {
          resolve();
        }
      });
    });

    const system = createSystem({
      registry: {
        receiver
      }
    });
    const machine = system.setup().createMachine({
      context: ({ spawn }) => {
        spawn(receiver, { registryKey: 'receiver' });
        return {};
      },
      on: {
        PING: ({ system }, enq) => {
          enq.sendTo(system.get('receiver'), { type: 'HELLO' });
        }
      }
    });

    system.createActor(machine).start().send({ type: 'PING' });

    return promise;
  });

  it('should register a spawned actor', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    type MySystem = ActorSystem<{
      actors: {
        receiver: ActorRef<Snapshot<unknown>, { type: 'HELLO' }>;
      };
    }>;

    const machine = createMachine({
      // types: {} as {
      //   context: {
      //     ref: CallbackActorRef<EventObject, unknown>;
      //     machineRef?: ActorRefFrom<AnyStateMachine>;
      //   };
      // },
      schemas: {
        context: z.object({
          ref: z.any(),
          machineRef: z.any()
        })
      },
      id: 'parent',
      context: ({ spawn }) => ({
        ref: spawn(
          createCallbackLogic(({ receive }) => {
            receive((event) => {
              expect(event.type).toBe('HELLO');
              resolve();
            });
          }),
          { registryKey: 'receiver' }
        )
      }),
      on: {
        toggle: (_, enq) => ({
          context: {
            machineRef: enq.spawn(
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
            )
          }
        })
      }
    });

    const actor = createActor(machine).start();

    actor.send({ type: 'toggle' });

    return promise;
  });

  it('system can be immediately accessed outside the actor', () => {
    const machine = createMachine({
      invoke: {
        registryKey: 'someChild',
        src: createMachine({})
      }
    });

    // no .start() here is important for the test
    const actor = createActor(machine);

    expect(actor.system.get('someChild')).toBeDefined();
  });

  it('root actor can be given the registryKey', () => {
    const machine = createMachine({});
    const actor = createActor(machine, { registryKey: 'test0' });
    expect(actor.system.get('test0')).toBe(actor);
  });

  it('should remove invoked actor from receptionist if stopped', () => {
    const machine = createMachine({
      initial: 'active',
      states: {
        active: {
          invoke: {
            src: createMachine({}),
            registryKey: 'test1'
          },
          on: {
            toggle: { target: 'inactive' }
          }
        },
        inactive: {}
      }
    });

    const actor = createActor(machine).start();

    expect(actor.system.get('test1')).toBeDefined();

    actor.send({ type: 'toggle' });

    expect(actor.system.get('test1')).toBeUndefined();
  });

  it('should remove spawned actor from receptionist if stopped', () => {
    const childMachine = createMachine({});
    const machine = createMachine({
      // types: {} as {
      //   context: {
      //     ref: ActorRefFrom<typeof childMachine>;
      //   };
      // },
      schemas: {
        context: z.object({
          ref: z.any()
        })
      },
      context: ({ spawn }) => ({
        ref: spawn(childMachine, {
          registryKey: 'test2'
        })
      }),
      on: {
        // toggle: {
        //   actions: stopChild(({ context }) => context.ref)
        // }
        toggle: ({ context }, enq) => ({
          context: {
            ref: enq.stop(context.ref)
          }
        })
      }
    });

    const actor = createActor(machine).start();

    expect(actor.system.get('test2')).toBeDefined();

    actor.send({ type: 'toggle' });

    expect(actor.system.get('test2')).toBeUndefined();
  });

  it('should throw an error if an actor with the registry key already exists', () => {
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            toggle: { target: 'active' }
          }
        },
        active: {
          invoke: [
            {
              src: createMachine({}),
              registryKey: 'test1'
            },
            {
              src: createMachine({}),
              registryKey: 'test1'
            }
          ]
        }
      }
    });

    const errorSpy = vi.fn();

    const actorRef = createActor(machine, { registryKey: 'test1' });
    actorRef.subscribe({
      error: errorSpy
    });
    actorRef.start();
    actorRef.send({ type: 'toggle' });

    expect(errorSpy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          [Error: Actor with registry key 'test1' already exists.],
        ],
      ]
    `);
  });

  it.skip('should cleanup stopped actors', () => {
    const machine = createMachine({
      // types: {
      //   context: {} as {
      //     ref: AnyActorRef;
      //   }
      // },
      schemas: {
        context: z.object({
          ref: z.any()
        })
      },
      context: ({ spawn }) => ({
        ref: spawn(createAsyncLogic({ run: () => Promise.resolve() }), {
          registryKey: 'test11'
        })
      }),
      on: {
        // stop: {
        //   actions: stopChild(({ context }) => context.ref)
        // },
        stop: ({ context }, enq) => {
          enq.stop(context.ref);
        },
        // start: {
        //   actions: spawnChild(
        //     createAsyncLogic(() => Promise.resolve()),
        //     {
        //       registryKey: 'test11'
        //     }
        //   )
        // }
        start: (_, enq) => {
          // This currently double-creates the actor:
          // 1. when getting transition result
          // 2. when actually executing it
          // Since it's set in the system twice, it triggers the error currently
          enq.spawn(createAsyncLogic({ run: () => Promise.resolve() }), {
            registryKey: 'test11'
          });
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
        registryKey: 'test3'
      },
      entry: ({ system }) => {
        expect(system?.get('test3')).toBeDefined();
      }
    });

    createActor(machine).start();
  });

  it('should be accessible in referenced custom actions', () => {
    const machine = createMachine({
      actions: {
        myAction: (system) => {
          expect(system.get('test4')).toBeDefined();
        }
      },
      invoke: {
        src: createMachine({}),
        registryKey: 'test4'
      },
      entry: ({ system, actions }, enq) => {
        enq(actions.myAction, system);
      }
    });

    createActor(machine).start();
  });

  it('should be accessible in sendTo actions', () => {
    const machine = createMachine({
      invoke: {
        src: createMachine({}),
        registryKey: 'test5'
      },
      initial: 'a',
      states: {
        a: {
          // entry: sendTo(
          //   ({ system }) => {
          //     expect(system.get('test5')).toBeDefined();
          //     return system.get('test5');
          //   },
          //   { type: 'FOO' }
          // )
          entry: ({ system }, enq) => {
            expect(system?.get('test5')).toBeDefined();
            enq.sendTo(system?.get('test5'), { type: 'FOO' });
          }
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
          registryKey: 'test6'
        },
        {
          src: createAsyncLogic({
            run: ({ system }) => {
              expect(system.get('test6')).toBeDefined();
              return Promise.resolve();
            }
          })
        }
      ]
    });

    const actor = createActor(machine).start();

    expect(actor.system.get('test6')).toBeDefined();
  });

  it('should be accessible in custom logic', () => {
    expect.assertions(2);
    const machine = createMachine({
      invoke: [
        {
          src: createMachine({}),
          registryKey: 'test7'
        },

        {
          src: createLogic({
            context: 0,
            run: ({ event, system }) => {
              if (event.type === '@xstate.init') {
                return;
              }
              expect(system.get('test7')).toBeDefined();
              return { context: 0 };
            }
          }),
          registryKey: 'reducer'
        }
      ]
    });

    const actor = createActor(machine).start();

    expect(actor.system.get('test7')).toBeDefined();

    // The assertion won't be checked until the transition function gets an event
    actor.system.get('reducer')!.send({ type: 'a' });
  });

  it('should be accessible in observable logic', () => {
    expect.assertions(2);
    const machine = createMachine({
      invoke: [
        {
          src: createMachine({}),
          registryKey: 'test8'
        },

        {
          src: createObservableLogic(({ system }) => {
            expect(system.get('test8')).toBeDefined();
            return of(0);
          })
        }
      ]
    });

    const actor = createActor(machine).start();

    expect(actor.system.get('test8')).toBeDefined();
  });

  it('should be accessible in event observable logic', () => {
    expect.assertions(2);
    const machine = createMachine({
      invoke: [
        {
          src: createMachine({}),
          registryKey: 'test9'
        },

        {
          src: createEventObservableLogic(({ system }) => {
            expect(system.get('test9')).toBeDefined();
            return of({ type: 'a' });
          })
        }
      ]
    });

    const actor = createActor(machine).start();

    expect(actor.system.get('test9')).toBeDefined();
  });

  it('should be accessible in callback logic', () => {
    expect.assertions(2);
    const machine = createMachine({
      invoke: [
        {
          src: createMachine({}),
          registryKey: 'test10'
        },
        {
          src: createCallbackLogic(({ system }) => {
            expect(system.get('test10')).toBeDefined();
          })
        }
      ]
    });

    const actor = createActor(machine).start();

    expect(actor.system.get('test10')).toBeDefined();
  });

  it('should gracefully handle re-registration of a `registryKey` during a reentering transition', () => {
    const spy = vi.fn();

    let counter = 0;

    const machine = createMachine({
      initial: 'listening',
      states: {
        listening: {
          invoke: {
            registryKey: 'listener',
            src: createCallbackLogic(({ receive }) => {
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

  it('should be able to send an event to an ancestor with a registered `registryKey` from an initial entry action', () => {
    const spy = vi.fn();

    const child = createMachine({
      // entry: sendTo(({ system }) => system.get('myRoot'), {
      //   type: 'EV'
      // })
      entry: ({ system }, enq) => {
        enq.sendTo(system?.get('myRoot'), { type: 'EV' });
      }
    });

    const machine = createMachine({
      invoke: {
        src: child
      },
      on: {
        // EV: {
        //   actions: spy
        // }
        EV: (_, enq) => {
          enq(spy);
        }
      }
    });
    createActor(machine, { registryKey: 'myRoot' }).start();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('registry key should be accessible on the actor', () => {
    const machine = createMachine({});
    const actor = createActor(machine, { registryKey: 'test' });
    expect(actor.registryKey).toBe('test');
  });

  it('should give a list of runnings actors', () => {
    const machine = createMachine({
      id: 'root',
      initial: 'happy path',
      states: {
        'happy path': {
          // entry: [spawnChild(createMachine({}), { registryKey: 'child1' })],
          entry: (_, enq) => {
            enq.spawn(createMachine({}), { registryKey: 'child1' });
          },
          invoke: {
            src: createMachine({}),
            registryKey: 'child2'
          },
          on: {
            stopChild1: { target: 'sad path' }
          }
        },
        'sad path': {
          // entry: stopChild(({ system }) => system.get('child1'))
          entry: ({ system }, enq) => {
            enq.stop(system?.get('child1'));
          }
        }
      }
    });

    const actor = createActor(machine).start();

    expect(actor.system.getAll()).toEqual({
      child1: actor.system.get('child1'),
      child2: actor.system.get('child2')
    });

    actor.send({ type: 'stopChild1' });

    expect(actor.system.getAll()).toEqual({});
  });

  it.skip('should unregister nested child registryKeys when stopping a parent actor', () => {
    const subchild = createMachine({});

    const child = createMachine({
      actorSources: {
        subchild
      },
      id: 'childSystem',
      invoke: {
        src: ({ actorSources }) => actorSources.subchild,
        registryKey: 'subchild'
      }
    });

    const parent = createMachine({
      actorSources: { child },

      // entry: spawnChild('child', { id: 'childId' }),
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child, { id: 'childId' });
      },
      on: {
        // restart: {
        //   actions: [
        //     stopChild('childId'),
        //     spawnChild('child', { id: 'childId' })
        //   ]
        // }
        restart: ({ children, actorSources }, enq) => {
          enq.stop(children.childId);
          enq.spawn(actorSources.child, { id: 'childId' });
        }
      }
    });

    const root = createActor(parent).start();

    expect(root.system.get('subchild')).toBeDefined();

    // This should not throw "Actor with registry key 'subchild' already exists"
    expect(() => root.send({ type: 'restart' })).not.toThrow();

    expect(root.system.get('subchild')).toBeDefined();
  });
});
