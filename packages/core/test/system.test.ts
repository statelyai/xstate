import { of } from 'rxjs';
import { z } from 'zod';
import { fromCallback } from '../src/actors/callback.ts';
import { SimulatedClock } from '../src/SimulatedClock.ts';
import {
  ActorRef,
  Snapshot,
  createActor,
  createSystem,
  createMachine,
  initialTransition as pureInitialTransition,
  transition as pureTransition,
  fromEventObservable,
  fromObservable,
  fromPromise,
  fromTransition
} from '../src/index.ts';
import { ActorSystem } from '../src/system.ts';

describe('system', () => {
  it('should create actors from an explicit system', () => {
    const sys = createSystem();
    const machine = createMachine({});

    const actor = sys.createActor(machine, { systemId: 'root' });

    expect(sys.get('root')).toBe(actor);
  });

  it('should allow explicit receptionist registration', () => {
    const sys = createSystem();
    const actor = createActor(createMachine({}));

    sys.register('receiver', actor);

    expect(sys.get('receiver')).toBe(actor);
  });

  it('should support deterministic session ID generation', () => {
    const sys = createSystem({
      sessionIdGenerator: (index) => `test-${index}`
    });

    const actorA = sys.createActor(createMachine({}));
    const actorB = sys.createActor(createMachine({}));

    expect(actorA.sessionId).toBe('test-0');
    expect(actorB.sessionId).toBe('test-1');
  });

  it('should support deterministic actor ID generation independently', () => {
    const sys = createSystem({
      sessionIdGenerator: (index) => `session-${index}`,
      actorIdGenerator: (index) => `actor-${index}`
    });

    const actorA = sys.createActor(createMachine({}));
    const actorB = sys.createActor(createMachine({}));

    expect(actorA.id).toBe('actor-0');
    expect(actorB.id).toBe('actor-1');
    expect(actorA.sessionId).toBe('session-0');
    expect(actorB.sessionId).toBe('session-1');
  });

  it('should use clock.now for scheduled event timestamps', () => {
    const clock = new SimulatedClock();
    clock.set(42);

    const sys = createSystem({ clock });
    const actor = sys.createActor(createMachine({})).start();

    sys.scheduler.schedule({
      source: actor,
      target: actor,
      event: { type: 'PING' },
      delay: 100,
      id: 't1'
    });

    const snapshot = sys.getSnapshot();
    const scheduled = Object.values(snapshot._scheduledEvents)[0];

    expect(scheduled.scheduledAt).toBe(42);
  });

  it('should support deterministic scheduled event ID generation', () => {
    const clock = new SimulatedClock();
    const sys = createSystem({
      clock,
      sessionIdGenerator: (index) => `test-${index}`,
      scheduledEventIdGenerator: (index) => `evt-${index}`
    });
    const actor = sys.createActor(createMachine({})).start();

    sys.scheduler.schedule({
      source: actor,
      target: actor,
      event: { type: 'PING' },
      delay: 100
    });
    sys.scheduler.schedule({
      source: actor,
      target: actor,
      event: { type: 'PONG' },
      delay: 100
    });

    const ids = Object.keys(sys.getSnapshot()._scheduledEvents).sort();
    expect(ids).toEqual(['test-0.evt-0', 'test-0.evt-1']);
  });

  it('should expose pure transition helpers on system', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: 'b' }
        },
        b: {}
      }
    });
    const sys = createSystem();

    const [initViaSystem] = sys.initialTransition(machine);
    const [initDirect] = pureInitialTransition(machine);
    expect(initViaSystem.value).toEqual(initDirect.value);

    const [nextViaSystem, actionsViaSystem] = sys.transition(
      machine,
      initViaSystem,
      {
        type: 'NEXT'
      }
    );
    const [nextDirect, actionsDirect] = pureTransition(machine, initDirect, {
      type: 'NEXT'
    });

    expect(nextViaSystem.value).toEqual(nextDirect.value);
    expect(actionsViaSystem).toHaveLength(actionsDirect.length);
  });

  it('should support custom effect ID generation for system transitions', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          entry: (_, enq) => {
            enq.log('init');
          },
          on: {
            NEXT: (_, enq) => {
              enq.log('next');
            }
          }
        }
      }
    });

    const sys = createSystem({
      effectIdGenerator: ({ event, index }) => `custom-${event.type}-${index}`
    });

    const [initState, initActions] = sys.initialTransition(machine);
    expect(initActions[0].id).toBe('custom-@xstate.init-0');

    const [, nextActions] = sys.transition(machine, initState, {
      type: 'NEXT'
    });
    expect(nextActions[0].id).toBe('custom-NEXT-0');
  });

  it('should expose register/get on implicit systems', () => {
    const root = createActor(createMachine({}));
    const actor = createActor(createMachine({}));

    root.system.register('receiver', actor);

    expect(root.system.get('receiver')).toBe(actor);
  });

  it('should expose receptionist on implicit systems', () => {
    const root = createActor(createMachine({}));
    const actor = createActor(createMachine({}));

    root.system.receptionist.register('receiver', actor);

    expect(root.system.receptionist.get('receiver')).toBe(actor);
  });

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
              src: fromCallback(({ receive }) => {
                receive((event) => {
                  expect(event.type).toBe('HELLO');
                  resolve();
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
          fromCallback(({ receive }) => {
            receive((event) => {
              expect(event.type).toBe('HELLO');
              resolve();
            });
          }),
          { systemId: 'receiver' }
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
    const actor = createActor(machine, { systemId: 'test0' });
    expect(actor.system.get('test0')).toBe(actor);
  });

  it('should remove invoked actor from receptionist if stopped', () => {
    const machine = createMachine({
      initial: 'active',
      states: {
        active: {
          invoke: {
            src: createMachine({}),
            systemId: 'test1'
          },
          on: {
            toggle: 'inactive'
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
          systemId: 'test2'
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
              systemId: 'test1'
            },
            {
              src: createMachine({}),
              systemId: 'test1'
            }
          ]
        }
      }
    });

    const errorSpy = vi.fn();

    const actorRef = createActor(machine, { systemId: 'test1' });
    actorRef.subscribe({
      error: errorSpy
    });
    actorRef.start();
    actorRef.send({ type: 'toggle' });

    expect(errorSpy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          [Error: Actor with system ID 'test1' already exists.],
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
        ref: spawn(
          fromPromise(() => Promise.resolve()),
          {
            systemId: 'test11'
          }
        )
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
        //     fromPromise(() => Promise.resolve()),
        //     {
        //       systemId: 'test11'
        //     }
        //   )
        // }
        start: (_, enq) => {
          // This currently double-creates the actor:
          // 1. when getting transition result
          // 2. when actually executing it
          // Since it's set in the system twice, it triggers the error currently
          enq.spawn(
            fromPromise(() => Promise.resolve()),
            {
              systemId: 'test11'
            }
          );
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
        systemId: 'test3'
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
        systemId: 'test4'
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
        systemId: 'test5'
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
          systemId: 'test6'
        },
        {
          src: fromPromise(({ system }) => {
            expect(system.get('test6')).toBeDefined();
            return Promise.resolve();
          })
        }
      ]
    });

    const actor = createActor(machine).start();

    expect(actor.system.get('test6')).toBeDefined();
  });

  it('should be accessible in transition logic', () => {
    expect.assertions(2);
    const machine = createMachine({
      invoke: [
        {
          src: createMachine({}),
          systemId: 'test7'
        },

        {
          src: fromTransition((_state, _event, { system }) => {
            expect(system.get('test7')).toBeDefined();
            return 0;
          }, 0),
          systemId: 'reducer'
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
          systemId: 'test8'
        },

        {
          src: fromObservable(({ system }) => {
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
          systemId: 'test9'
        },

        {
          src: fromEventObservable(({ system }) => {
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
          systemId: 'test10'
        },
        {
          src: fromCallback(({ system }) => {
            expect(system.get('test10')).toBeDefined();
          })
        }
      ]
    });

    const actor = createActor(machine).start();

    expect(actor.system.get('test10')).toBeDefined();
  });

  it('should gracefully handle re-registration of a `systemId` during a reentering transition', () => {
    const spy = vi.fn();

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
    createActor(machine, { systemId: 'myRoot' }).start();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('system ID should be accessible on the actor', () => {
    const machine = createMachine({});
    const actor = createActor(machine, { systemId: 'test' });
    expect(actor.systemId).toBe('test');
  });

  it('should give a list of runnings actors', () => {
    const machine = createMachine({
      id: 'root',
      initial: 'happy path',
      states: {
        'happy path': {
          // entry: [spawnChild(createMachine({}), { systemId: 'child1' })],
          entry: (_, enq) => {
            enq.spawn(createMachine({}), { systemId: 'child1' });
          },
          invoke: {
            src: createMachine({}),
            systemId: 'child2'
          },
          on: {
            stopChild1: 'sad path'
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

  it.skip('should unregister nested child systemIds when stopping a parent actor', () => {
    const subchild = createMachine({});

    const child = createMachine({
      actors: {
        subchild
      },
      id: 'childSystem',
      invoke: {
        src: ({ actors }) => actors.subchild,
        systemId: 'subchild'
      }
    });

    const parent = createMachine({
      actors: { child },

      // entry: spawnChild('child', { id: 'childId' }),
      entry: ({ actors }, enq) => {
        enq.spawn(actors.child, { id: 'childId' });
      },
      on: {
        // restart: {
        //   actions: [
        //     stopChild('childId'),
        //     spawnChild('child', { id: 'childId' })
        //   ]
        // }
        restart: ({ children, actors }, enq) => {
          enq.stop(children.childId);
          enq.spawn(actors.child, { id: 'childId' });
        }
      }
    });

    const root = createActor(parent).start();

    expect(root.system.get('subchild')).toBeDefined();

    // This should not throw "Actor with system ID 'subchild' already exists"
    expect(() => root.send({ type: 'restart' })).not.toThrow();

    expect(root.system.get('subchild')).toBeDefined();
  });
});
