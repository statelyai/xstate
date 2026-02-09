import { setTimeout as sleep } from 'node:timers/promises';
import { EMPTY, interval, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { CallbackActorRef, fromCallback } from '../src/actors/callback.ts';
import {
  fromEventObservable,
  fromObservable
} from '../src/actors/observable.ts';
import {
  PromiseActorLogic,
  PromiseActorRef,
  fromPromise
} from '../src/actors/promise.ts';
import { fromTransition } from '../src/actors/transition.ts';
import {
  ActorLogic,
  ActorRef,
  ActorRefFrom,
  AnyActorRef,
  EventObject,
  Observer,
  Snapshot,
  Subscribable,
  createActor,
  waitFor,
  createMachine
} from '../src/index.ts';
import z from 'zod';

describe('spawning machines', () => {
  const context = {
    todoRefs: {} as Record<string, AnyActorRef>
  };

  type TodoEvent =
    | {
        type: 'ADD';
        id: number;
      }
    | {
        type: 'SET_COMPLETE';
        id: number;
      }
    | {
        type: 'TODO_COMPLETED';
      };

  // Adaptation: https://github.com/p-org/P/wiki/PingPong-program
  type PingPongEvent =
    | { type: 'PING' }
    | { type: 'PONG' }
    | { type: 'SUCCESS' };

  const serverMachine = createMachine({
    // types: {} as {
    //   events: PingPongEvent;
    // },
    schemas: {
      events: {
        PING: z.object({}),
        PONG: z.object({}),
        SUCCESS: z.object({})
      }
    },
    id: 'server',
    initial: 'waitPing',
    states: {
      waitPing: {
        on: {
          PING: 'sendPong'
        }
      },
      sendPong: {
        // entry: [sendParent({ type: 'PONG' }), raise({ type: 'SUCCESS' })],
        entry: ({ parent }, enq) => {
          enq.sendTo(parent, { type: 'PONG' });
          enq.raise({ type: 'SUCCESS' });
        },
        on: {
          SUCCESS: 'waitPing'
        }
      }
    }
  });

  interface ClientContext {
    server?: ActorRef<Snapshot<unknown>, PingPongEvent>;
  }

  const clientMachine = createMachine({
    // types: {} as { context: ClientContext; events: PingPongEvent },
    schemas: {
      context: z.object({
        server: z.any()
      }),
      events: {
        PING: z.object({}),
        PONG: z.object({}),
        SUCCESS: z.object({})
      }
    },
    id: 'client',
    initial: 'init',
    context: {
      server: undefined
    },
    states: {
      init: {
        entry: (_, enq) => {
          const server = enq.spawn(serverMachine);
          enq.raise({ type: 'SUCCESS' });
          return {
            context: {
              server
            }
          };
        },
        on: {
          SUCCESS: 'sendPing'
        }
      },
      sendPing: {
        // entry: [
        //   sendTo(({ context }) => context.server!, { type: 'PING' }),
        //   raise({ type: 'SUCCESS' })
        // ],
        entry: ({ context }, enq) => {
          enq.sendTo(context.server, { type: 'PING' });
          enq.raise({ type: 'SUCCESS' });
        },
        on: {
          SUCCESS: 'waitPong'
        }
      },
      waitPong: {
        on: {
          PONG: 'complete'
        }
      },
      complete: {
        type: 'final'
      }
    }
  });

  it('should spawn machines', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const todoMachine = createMachine({
      id: 'todo',
      initial: 'incomplete',
      states: {
        incomplete: {
          on: { SET_COMPLETE: 'complete' }
        },
        complete: {
          // entry: sendParent({ type: 'TODO_COMPLETED' })
          entry: ({ parent }, enq) => {
            enq.sendTo(parent, { type: 'TODO_COMPLETED' });
          }
        }
      }
    });

    const todosMachine = createMachine({
      // types: {} as {
      //   context: typeof context;
      //   events: TodoEvent;
      // },
      schemas: {
        context: z.object({
          todoRefs: z.record(z.any())
        }),
        events: {
          ADD: z.object({ id: z.number() }),
          SET_COMPLETE: z.object({ id: z.number() }),
          TODO_COMPLETED: z.object({})
        }
      },
      id: 'todos',
      context,
      initial: 'active',
      states: {
        active: {
          on: {
            TODO_COMPLETED: 'success'
          }
        },
        success: {
          type: 'final'
        }
      },
      on: {
        ADD: ({ context, event }, enq) => ({
          context: {
            todoRefs: {
              ...context.todoRefs,
              [event.id]: enq.spawn(todoMachine)
            }
          }
        }),
        SET_COMPLETE: ({ context, event }, enq) => {
          enq.sendTo(context.todoRefs[event.id], { type: 'SET_COMPLETE' });
        }
      }
    });
    const service = todosMachine.createActor();
    service.subscribe({
      complete: () => {
        resolve();
      }
    });
    service.start();

    service.trigger.ADD({ id: 42 });
    service.trigger.SET_COMPLETE({ id: 42 });
    return promise;
  });

  it('should spawn referenced machines', () => {
    const childMachine = createMachine({
      // entry: sendParent({ type: 'DONE' })
      entry: ({ parent }, enq) => {
        enq.sendTo(parent, { type: 'DONE' });
      }
    });

    const parentMachine = createMachine({
      schemas: {
        context: z.object({
          ref: z.custom<AnyActorRef>()
        })
      },
      context: {
        ref: null! as AnyActorRef
      },
      actors: {
        childMachine
      },
      initial: 'waiting',
      states: {
        waiting: {
          entry: ({ actors }, enq) => ({
            context: {
              ref: enq.spawn(actors.childMachine)
            }
          }),
          on: {
            DONE: 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const actor = parentMachine.createActor();
    actor.start();
    expect(actor.getSnapshot().value).toBe('success');
  });

  it('should allow bidirectional communication between parent/child actors', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const actor = clientMachine.createActor();
    actor.subscribe({
      complete: () => {
        resolve();
      }
    });
    actor.start();
    return promise;
  });
});

describe('spawning promises', () => {
  it('should be able to spawn a promise', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const promiseMachine = createMachine({
      schemas: {
        context: z.object({
          promiseRef: z.custom<PromiseActorRef<string>>().optional()
        })
      },
      id: 'promise',
      initial: 'idle',
      context: {
        promiseRef: undefined
      },
      states: {
        idle: {
          entry: (_, enq) => ({
            context: {
              promiseRef: enq.spawn(
                fromPromise(() => Promise.resolve('response')),
                { id: 'my-promise' }
              )
            }
          }),
          on: {
            'xstate.done.actor.my-promise': ({ event }) => {
              if (event.output === 'response') {
                return {
                  target: 'success'
                };
              }
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const promiseService = promiseMachine.createActor();
    promiseService.subscribe({
      complete: () => {
        resolve();
      }
    });

    promiseService.start();
    return promise;
  });

  it('should be able to spawn a referenced promise', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const promiseMachine = createMachine({
      schemas: {
        context: z.object({
          promiseRef: z.custom<PromiseActorRef<string>>().optional()
        })
      },
      actors: {
        somePromise: fromPromise(() => Promise.resolve('response'))
      },
      id: 'promise',
      initial: 'idle',
      context: {
        promiseRef: undefined
      },
      states: {
        idle: {
          entry: ({ actors }, enq) => ({
            context: {
              promiseRef: enq.spawn(actors.somePromise, { id: 'my-promise' })
            }
          }),
          on: {
            'xstate.done.actor.my-promise': ({ event }) => {
              if (event.output === 'response') {
                return {
                  target: 'success'
                };
              }
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const promiseService = promiseMachine.createActor();
    promiseService.subscribe({
      complete: () => {
        resolve();
      }
    });

    promiseService.start();
    return promise;
  });
});

describe('spawning callbacks', () => {
  it('should be able to spawn an actor from a callback', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const callbackMachine = createMachine({
      schemas: {
        context: z.object({
          callbackRef: z
            .custom<CallbackActorRef<{ type: 'START' }>>()
            .optional()
        }),
        events: {
          START_CB: z.object({}),
          SEND_BACK: z.object({})
        }
      },
      id: 'callback',
      initial: 'idle',
      context: {
        callbackRef: undefined
      },
      states: {
        idle: {
          entry: (_, enq) => ({
            context: {
              callbackRef: enq.spawn(
                fromCallback<{ type: 'START' }>(({ sendBack, receive }) => {
                  receive((event) => {
                    if (event.type === 'START') {
                      setTimeout(() => {
                        sendBack({ type: 'SEND_BACK' });
                      }, 10);
                    }
                  });
                })
              )
            }
          }),
          on: {
            // START_CB: {
            //   actions: sendTo(({ context }) => context.callbackRef!, {
            //     type: 'START'
            //   })
            // },
            START_CB: ({ context }, enq) => {
              enq.sendTo(context.callbackRef, {
                type: 'START'
              });
            },
            SEND_BACK: 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const callbackService = callbackMachine.createActor();
    callbackService.subscribe({
      complete: () => {
        resolve();
      }
    });

    callbackService.start();
    callbackService.trigger.START_CB();
    return promise;
  });

  it('should not deliver events sent to the parent after the callback actor gets stopped', () => {
    const spy = vi.fn();

    let sendToParent: () => void;

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          invoke: {
            src: fromCallback(({ sendBack }) => {
              sendToParent = () =>
                sendBack({
                  type: 'FROM_CALLBACK'
                });
            })
          },
          on: {
            NEXT: 'b'
          }
        },
        b: {}
      },
      on: {
        // FROM_CALLBACK: {
        //   actions: spy
        // }
        FROM_CALLBACK: (_, enq) => {
          enq(spy);
        }
      }
    });

    const actorRef = machine.createActor().start();
    actorRef.send({ type: 'NEXT' });

    sendToParent!();

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('spawning observables', () => {
  it('should spawn an observable', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const observableLogic = fromObservable(() => interval(10));
    const observableMachine = createMachine({
      id: 'observable',
      initial: 'idle',
      schemas: {
        context: z.object({
          observableRef: z.custom<ActorRefFrom<typeof observableLogic>>()
        })
      },
      context: {
        observableRef: undefined! as ActorRefFrom<typeof observableLogic>
      },
      states: {
        idle: {
          entry: (_, enq) => ({
            context: {
              observableRef: enq.spawn(observableLogic, {
                id: 'int',
                syncSnapshot: true
              })
            }
          }),
          on: {
            'xstate.snapshot.int': ({ event }) => {
              if (event.snapshot.context === 5) {
                return {
                  target: 'success'
                };
              }
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const observableService = observableMachine.createActor();
    observableService.subscribe({
      complete: () => {
        resolve();
      }
    });

    observableService.start();
    return promise;
  });

  it('should spawn a referenced observable', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const observableMachine = createMachine({
      id: 'observable',
      initial: 'idle',
      schemas: {
        context: z.object({
          observableRef: z.custom<AnyActorRef>()
        })
      },
      context: {
        observableRef: undefined! as AnyActorRef
      },
      actors: {
        interval: fromObservable(() => interval(10))
      },
      states: {
        idle: {
          entry: (_, enq) => ({
            context: {
              observableRef: enq.spawn(
                fromObservable(() => interval(10)),
                { id: 'int', syncSnapshot: true }
              )
            }
          }),
          on: {
            'xstate.snapshot.int': ({ event }) => {
              if (event.snapshot.context === 5) {
                return {
                  target: 'success'
                };
              }
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const observableService = observableMachine.createActor();
    observableService.subscribe({
      complete: () => {
        resolve();
      }
    });

    observableService.start();
    return promise;
  });

  it(`should read the latest snapshot of the event's origin while handling that event`, () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const observableLogic = fromObservable(() => interval(10));
    const observableMachine = createMachine({
      id: 'observable',
      schemas: {
        context: z.object({
          observableRef: z.custom<AnyActorRef>()
        }),
        events: {
          COUNT: z.object({ val: z.number() })
        }
      },
      initial: 'idle',
      context: {
        observableRef: undefined! as ActorRefFrom<typeof observableLogic>
      },
      states: {
        idle: {
          entry: (_, enq) => ({
            context: {
              observableRef: enq.spawn(observableLogic, {
                id: 'int',
                syncSnapshot: true
              })
            }
          }),
          on: {
            'xstate.snapshot.int': ({ event }) => {
              if (event.snapshot.context === 1) {
                return {
                  target: 'success'
                };
              }
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const observableService = observableMachine.createActor();
    observableService.subscribe({
      complete: () => {
        resolve();
      }
    });

    observableService.start();
    return promise;
  });

  it('should notify direct child listeners with final snapshot before it gets stopped', async () => {
    const intervalActor = fromObservable(() => interval(10));

    const parentMachine = createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'interval';
      //     id: 'childActor';
      //     logic: typeof intervalActor;
      //   };
      // },
      actors: {
        interval: intervalActor
      },
      initial: 'active',
      states: {
        active: {
          invoke: {
            id: 'childActor',
            src: ({ actors }) => actors.interval,
            // onSnapshot: {
            //   target: 'success',
            //   guard: ({ event }) => {
            //     return event.snapshot.context === 3;
            //   }
            // }
            onSnapshot: ({ event }) => {
              if (event.snapshot.context === 3) {
                return {
                  target: 'success'
                };
              }
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const actorRef = parentMachine.createActor();
    actorRef.start();

    await waitFor(actorRef, (state) => state.matches('active'));

    const spy = vi.fn();

    actorRef.getSnapshot().children.childActor!.subscribe((data) => {
      spy(data.context);
    });

    await waitFor(actorRef, (state) => state.status !== 'active');

    expect(spy).toHaveBeenCalledWith(3);
  });

  it('should not notify direct child listeners after it gets stopped', async () => {
    const intervalActor = fromObservable(() => interval(10));

    const parentMachine = createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'interval';
      //     id: 'childActor';
      //     logic: typeof intervalActor;
      //   };
      // },
      actors: {
        interval: intervalActor
      },
      initial: 'active',
      states: {
        active: {
          invoke: {
            id: 'childActor',
            src: ({ actors }) => actors.interval,
            // onSnapshot: {
            //   target: 'success',
            //   guard: ({ event }) => {
            //     return event.snapshot.context === 3;
            //   }
            // }
            onSnapshot: ({ event }) => {
              if (event.snapshot.context === 3) {
                return {
                  target: 'success'
                };
              }
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const actorRef = parentMachine.createActor();
    actorRef.start();

    await waitFor(actorRef, (state) => state.matches('active'));

    const spy = vi.fn();

    actorRef.getSnapshot().children.childActor!.subscribe((data) => {
      spy(data);
    });

    await waitFor(actorRef, (state) => state.status !== 'active');
    spy.mockClear();

    // wait for potential next event from the interval actor
    await sleep(15);

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('spawning event observables', () => {
  it('should spawn an event observable', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const eventObservableLogic = fromEventObservable(() =>
      interval(10).pipe(map((val) => ({ type: 'COUNT', val })))
    );
    const observableMachine = createMachine({
      id: 'observable',
      schemas: {
        context: z.object({
          observableRef: z.custom<AnyActorRef>()
        }),
        events: {
          COUNT: z.object({ val: z.number() })
        }
      },
      initial: 'idle',
      context: {
        observableRef: undefined! as ActorRefFrom<typeof eventObservableLogic>
      },
      states: {
        idle: {
          // entry: assign({
          //   observableRef: ({ spawn }) => {
          //     const ref = spawn(eventObservableLogic, { id: 'int' });

          //     return ref;
          //   }
          // }),
          entry: (_, enq) => ({
            context: {
              observableRef: enq.spawn(eventObservableLogic, { id: 'int' })
            }
          }),
          on: {
            // COUNT: {
            //   target: 'success',
            //   guard: ({ event }) => event.val === 5
            // }
            COUNT: ({ event }) => {
              if (event.val === 5) {
                return {
                  target: 'success'
                };
              }
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const observableService = observableMachine.createActor();
    observableService.subscribe({
      complete: () => {
        resolve();
      }
    });

    observableService.start();
    return promise;
  });

  it('should spawn a referenced event observable', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const observableMachine = createMachine({
      id: 'observable',
      schemas: {
        context: z.object({
          observableRef: z.custom<AnyActorRef>()
        }),
        events: {
          COUNT: z.object({ val: z.number() })
        }
      },
      actors: {
        interval: fromEventObservable(() =>
          interval(10).pipe(map((val) => ({ type: 'COUNT', val })))
        )
      },
      initial: 'idle',
      context: {
        observableRef: undefined! as AnyActorRef
      },
      states: {
        idle: {
          entry: (_, enq) => ({
            context: {
              observableRef: enq.spawn(
                fromEventObservable(() =>
                  interval(10).pipe(map((val) => ({ type: 'COUNT', val })))
                ),
                { id: 'int' }
              )
            }
          }),
          on: {
            COUNT: ({ event }) => {
              if (event.val === 5) {
                return {
                  target: 'success'
                };
              }
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const observableService = observableMachine.createActor();
    observableService.subscribe({
      complete: () => {
        resolve();
      }
    });

    observableService.start();
    return promise;
  });
});

describe('communicating with spawned actors', () => {
  it('should treat an interpreter as an actor', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const existingMachine = createMachine({
      schemas: {
        events: {
          ACTIVATE: z.object({ origin: z.custom<AnyActorRef>() })
        }
      },
      initial: 'inactive',
      states: {
        inactive: {
          on: { ACTIVATE: 'active' }
        },
        // active: {
        //   entry: sendTo(({ event }) => event.origin, { type: 'EXISTING.DONE' })
        // }
        active: {
          entry: ({ event }, enq) => {
            enq.sendTo(event.origin, { type: 'EXISTING.DONE' });
          }
        }
      }
    });

    const existingService = existingMachine.createActor().start();

    const parentMachine = createMachine({
      schemas: {
        context: z.object({
          existingRef: z.custom<typeof existingService>().optional()
        }),
        events: {
          // TODO: this causes parentMachine to be any
          ACTIVATE: z.object({ origin: z.custom<typeof parentService>() }),
          'EXISTING.DONE': z.object({})
        }
      },
      initial: 'pending',
      context: {
        existingRef: existingService
      },
      states: {
        pending: {
          entry: () => {
            return {
              context: {
                existingRef: existingService
              }
            };
          },
          on: {
            'EXISTING.DONE': 'success'
          },
          after: {
            100: ({ context, self }, enq) => {
              expect(context.existingRef).toBeDefined();
              enq.sendTo(context.existingRef, {
                type: 'ACTIVATE',
                origin: self
              });
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const parentService = parentMachine.createActor();
    parentService.subscribe({
      complete: () => {
        resolve();
      }
    });

    parentService.start();
    return promise;
  });
});

describe('actors', () => {
  it('should only spawn actors defined on initial state once', () => {
    let count = 0;

    const startMachine = createMachine({
      // types: {} as { context: { items: number[]; refs: any[] } },
      schemas: {
        context: z.object({
          items: z.array(z.number()),
          refs: z.array(z.any())
        })
      },
      id: 'start',
      initial: 'start',
      context: {
        items: [0, 1, 2, 3],
        refs: []
      },
      states: {
        start: {
          entry: ({ context }, enq) => {
            enq(() => count++);
            return {
              context: {
                ...context,
                refs: context.items.map((item) =>
                  enq.spawn(fromPromise(() => new Promise((res) => res(item))))
                )
              }
            };
          }
        }
      }
    });

    const actor = startMachine.createActor();
    actor.subscribe(() => {
      expect(count).toEqual(1);
    });
    actor.start();
  });

  it('should spawn an actor in an initial state of a child that gets invoked in the initial state of a parent when the parent gets started', () => {
    let spawnCounter = 0;

    const child = createMachine({
      // types: {} as { context: TestContext },
      schemas: {
        context: z.object({
          promise: z
            .object({
              send: z.function().args(z.any()).returns(z.any())
            })
            .optional()
        })
      },
      initial: 'bar',
      context: {},
      states: {
        bar: {
          // entry: assign({
          //   promise: ({ spawn }) => {
          //     return spawn(
          //       fromPromise(() => {
          //         spawnCounter++;
          //         return Promise.resolve('answer');
          //       })
          //     );
          //   }
          // })
          entry: (_, enq) => ({
            context: {
              promise: enq.spawn(
                fromPromise(() => {
                  spawnCounter++;
                  return Promise.resolve('answer');
                })
              )
            }
          })
        }
      }
    });

    const parent = createMachine({
      initial: 'foo',
      states: {
        foo: {
          invoke: {
            src: child,
            onDone: 'end'
          }
        },
        end: { type: 'final' }
      }
    });
    parent.createActor().start();
    expect(spawnCounter).toBe(1);
  });

  // https://github.com/statelyai/xstate/issues/2565
  it('should only spawn an initial actor once when it synchronously responds with an event', () => {
    let spawnCalled = 0;
    const anotherMachine = createMachine({
      initial: 'hello',
      states: {
        hello: {
          // entry: sendParent({ type: 'ping' })
          entry: ({ parent }, enq) => {
            enq.sendTo(parent, { type: 'ping' });
          }
        }
      }
    });

    const testMachine = createMachine({
      schemas: {
        context: z.object({
          ref: z.custom<ActorRefFrom<typeof anotherMachine>>().optional()
        })
      },
      initial: 'testing',
      context: ({ spawn }) => {
        spawnCalled++;
        // throw in case of an infinite loop
        expect(spawnCalled).toBe(1);
        return {
          ref: spawn(anotherMachine)
        };
      },
      states: {
        testing: {
          on: {
            ping: {
              target: 'done'
            }
          }
        },
        done: {}
      }
    });

    const service = testMachine.createActor().start();
    expect(service.getSnapshot().value).toEqual('done');
  });

  it('should spawn null actors if not used within a service', () => {
    const nullActorMachine = createMachine({
      // types: {} as { context: { ref?: PromiseActorRef<number> } },
      schemas: {
        context: z.object({
          ref: z.custom<PromiseActorRef<number>>().optional()
        })
      },
      initial: 'foo',
      context: { ref: undefined },
      states: {
        foo: {
          // entry: assign({
          //   ref: ({ spawn }) => spawn(fromPromise(() => Promise.resolve(42)))
          // })
          entry: (_, enq) => ({
            context: {
              ref: enq.spawn(fromPromise(() => Promise.resolve(42)))
            }
          })
        }
      }
    });

    // expect(nullActorMachine.createActor().getSnapshot().context.ref!.id).toBe('null'); // TODO: identify null actors
    expect(
      nullActorMachine.createActor().getSnapshot().context.ref!.send
    ).toBeDefined();
  });

  it('should stop multiple inline spawned actors that have no explicit ids', () => {
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();

    const parent = createMachine({
      schemas: {
        context: z.object({
          ref1: z.custom<AnyActorRef>(),
          ref2: z.custom<AnyActorRef>()
        })
      },
      context: ({ spawn }) => ({
        ref1: spawn(fromCallback(() => cleanup1)),
        ref2: spawn(fromCallback(() => cleanup2))
      })
    });
    const actorRef = parent.createActor().start();

    expect(Object.keys(actorRef.getSnapshot().children).length).toBe(2);

    actorRef.stop();

    expect(cleanup1).toBeCalledTimes(1);
    expect(cleanup2).toBeCalledTimes(1);
  });

  it('should stop multiple referenced spawned actors that have no explicit ids', () => {
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();

    const parent = createMachine({
      schemas: {
        context: z.object({
          ref1: z.custom<AnyActorRef>(),
          ref2: z.custom<AnyActorRef>()
        })
      },
      context: ({ spawn, actors }) => ({
        ref1: spawn(actors.child1),
        ref2: spawn(actors.child2)
      }),
      actors: {
        child1: fromCallback(() => cleanup1),
        child2: fromCallback(() => cleanup2)
      }
    });
    const actorRef = parent.createActor().start();

    expect(Object.keys(actorRef.getSnapshot().children).length).toBe(2);

    actorRef.stop();

    expect(cleanup1).toBeCalledTimes(1);
    expect(cleanup2).toBeCalledTimes(1);
  });

  describe('with actor logic', () => {
    it('should work with a transition function logic', () => {
      const { resolve, promise } = Promise.withResolvers<void>();
      const countLogic = fromTransition((count: number, event: any) => {
        if (event.type === 'INC') {
          return count + 1;
        } else if (event.type === 'DEC') {
          return count - 1;
        }
        return count;
      }, 0);

      const countMachine = createMachine({
        // types: {} as {
        //   context: { count: ActorRefFrom<typeof countLogic> | undefined };
        // },
        schemas: {
          context: z.object({
            count: z.custom<ActorRefFrom<typeof countLogic>>().optional()
          })
        },
        context: {
          count: undefined
        },
        // entry: assign({
        //   count: ({ spawn }) => spawn(countLogic)
        // }),
        entry: (_, enq) => ({
          context: {
            count: enq.spawn(countLogic)
          }
        }),
        on: {
          // INC: {
          //   actions: forwardTo(({ context }) => context.count!)
          // }
          INC: ({ context, event }, enq) => {
            enq.sendTo(context.count, event);
          }
        }
      });

      const countService = countMachine.createActor();
      countService.subscribe((state) => {
        if (state.context.count?.getSnapshot().context === 2) {
          resolve();
        }
      });
      countService.start();

      countService.send({ type: 'INC' });
      countService.send({ type: 'INC' });

      expect(
        countService.getSnapshot().context.count?.getSnapshot().context
      ).toBe(2);

      return promise;
    });

    it('should work with a promise logic (fulfill)', () => {
      const { resolve, promise } = Promise.withResolvers<void>();
      const countMachine = createMachine({
        // types: {} as {
        //   context: {
        //     count: ActorRefFrom<PromiseActorLogic<number>> | undefined;
        //   };
        // },
        schemas: {
          context: z.object({
            count: z
              .custom<ActorRefFrom<PromiseActorLogic<number>>>()
              .optional()
          })
        },
        context: {
          count: undefined
        },
        // entry: assign({
        //   count: ({ spawn }) =>
        //     spawn(
        //       fromPromise(
        //         () =>
        //           new Promise<number>((res) => {
        //             setTimeout(() => res(42));
        //           })
        //       ),
        //       { id: 'test' }
        //     )
        // }),
        entry: (_, enq) => ({
          context: {
            count: enq.spawn(
              fromPromise(
                () =>
                  new Promise<number>((res) => {
                    setTimeout(() => res(42));
                  })
              ),
              { id: 'test' }
            )
          }
        }),
        initial: 'pending',
        states: {
          pending: {
            on: {
              // 'xstate.done.actor.test': {
              //   target: 'success',
              //   guard: ({ event }) => event.output === 42
              // }
              'xstate.done.actor.test': ({ event }) => {
                if (event.output === 42) {
                  return {
                    target: 'success'
                  };
                }
              }
            }
          },
          success: {
            type: 'final'
          }
        }
      });

      const countService = countMachine.createActor();
      countService.subscribe({
        complete: () => {
          resolve();
        }
      });
      countService.start();
      return promise;
    });

    it('should work with a promise logic (reject)', () => {
      const { resolve, promise } = Promise.withResolvers<void>();
      const errorMessage = 'An error occurred';
      const countMachine = createMachine({
        // types: {} as {
        //   context: { count: ActorRefFrom<PromiseActorLogic<number>> };
        // },
        schemas: {
          context: z.object({
            count: z.custom<ActorRefFrom<PromiseActorLogic<number>>>()
          })
        },
        context: ({ spawn }) => ({
          count: spawn(
            fromPromise(
              () =>
                new Promise<number>((_, rej) => {
                  setTimeout(() => rej(errorMessage), 1);
                })
            ),
            { id: 'test' }
          )
        }),
        initial: 'pending',
        states: {
          pending: {
            on: {
              // 'xstate.error.actor.test': {
              //   target: 'success',
              //   guard: ({ event }) => {
              //     return event.error === errorMessage;
              //   }
              // }
              'xstate.error.actor.test': ({ event }) => {
                if (event.error === errorMessage) {
                  return {
                    target: 'success'
                  };
                }
              }
            }
          },
          success: {
            type: 'final'
          }
        }
      });

      const countService = countMachine.createActor();
      countService.subscribe({
        complete: () => {
          resolve();
        }
      });
      countService.start();
      return promise;
    });

    it('actor logic should have reference to the parent', () => {
      const { resolve, promise } = Promise.withResolvers<void>();
      const pongLogic: ActorLogic<Snapshot<undefined>, EventObject> = {
        transition: (state, event, { self }) => {
          if (event.type === 'PING') {
            self._parent?.send({ type: 'PONG' });
          }

          return state;
        },
        getInitialSnapshot: () => ({
          status: 'active',
          output: undefined,
          error: undefined
        }),
        getPersistedSnapshot: (s) => s
      };

      const pingMachine = createMachine({
        // types: {} as {
        //   context: { ponger: ActorRefFrom<typeof pongLogic> | undefined };
        // },
        schemas: {
          context: z.object({
            ponger: z.custom<ActorRefFrom<typeof pongLogic>>().optional()
          })
        },
        initial: 'waiting',
        context: {
          ponger: undefined
        },
        // entry: assign({
        //   ponger: ({ spawn }) => spawn(pongLogic)
        // }),
        entry: (_, enq) => ({
          context: {
            ponger: enq.spawn(pongLogic)
          }
        }),
        states: {
          waiting: {
            // entry: sendTo(({ context }) => context.ponger!, { type: 'PING' }),
            entry: ({ context }, enq) => {
              enq.sendTo(context.ponger!, { type: 'PING' });
            },
            invoke: {
              id: 'ponger',
              src: pongLogic
            },
            on: {
              PONG: 'success'
            }
          },
          success: {
            type: 'final'
          }
        }
      });

      const pingService = pingMachine.createActor();
      pingService.subscribe({
        complete: () => {
          resolve();
        }
      });
      pingService.start();
      return promise;
    });
  });

  it('should be able to spawn callback actors in (lazy) initial context', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const machine = createMachine({
      // types: {} as { context: { ref: CallbackActorRef<EventObject> } },
      schemas: {
        context: z.object({
          ref: z.custom<CallbackActorRef<EventObject>>()
        })
      },
      context: ({ spawn }) => ({
        ref: spawn(
          fromCallback(({ sendBack }) => {
            sendBack({ type: 'TEST' });
          })
        )
      }),
      initial: 'waiting',
      states: {
        waiting: {
          on: { TEST: 'success' }
        },
        success: {
          type: 'final'
        }
      }
    });

    const actor = machine.createActor();
    actor.subscribe({
      complete: () => {
        resolve();
      }
    });
    actor.start();
    return promise;
  });

  it('should be able to spawn machines in (lazy) initial context', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const childMachine = createMachine({
      // entry: sendParent({ type: 'TEST' })
      entry: ({ parent }, enq) => {
        enq.sendTo(parent, { type: 'TEST' });
      }
    });

    const machine = createMachine({
      // types: {} as { context: { ref: ActorRefFrom<typeof childMachine> } },
      schemas: {
        context: z.object({
          ref: z.custom<ActorRefFrom<typeof childMachine>>()
        })
      },
      context: ({ spawn }) => ({
        ref: spawn(childMachine)
      }),
      initial: 'waiting',
      states: {
        waiting: {
          on: { TEST: 'success' }
        },
        success: {
          type: 'final'
        }
      }
    });

    const actor = machine.createActor();
    actor.subscribe({
      complete: () => {
        resolve();
      }
    });
    actor.start();
    return promise;
  });

  // https://github.com/statelyai/xstate/issues/2507
  it('should not crash on child machine sync completion during self-initialization', () => {
    const childMachine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          always: {
            target: 'stopped'
          }
        },
        stopped: {
          type: 'final'
        }
      }
    });

    const parentMachine = createMachine({
      // types: {} as {
      //   context: { child: ActorRefFrom<typeof childMachine> | null };
      // },
      schemas: {
        context: z.object({
          child: z.custom<ActorRefFrom<typeof childMachine>>().nullable()
        })
      },
      context: {
        child: null
      },
      entry: (_, enq) => ({
        context: {
          child: enq.spawn(childMachine)
        }
      })
    });
    const service = parentMachine.createActor();
    expect(() => {
      service.start();
    }).not.toThrow();
  });

  it('should not crash on child promise-like sync completion during self-initialization', () => {
    const promiseLogic = fromPromise(
      () => ({ then: (fn: any) => fn(null) }) as any
    );
    const parentMachine = createMachine({
      schemas: {
        context: z.object({
          child: z
            .object({
              send: z.function().args(z.any()).returns(z.any())
            })
            .nullable()
        })
      },
      context: {
        child: null
      },
      // entry: assign({
      //   child: ({ spawn }) => spawn(promiseLogic)
      // })
      entry: (_, enq) => ({
        context: {
          child: enq.spawn(promiseLogic)
        }
      })
    });
    const service = parentMachine.createActor();
    expect(() => {
      service.start();
    }).not.toThrow();
  });

  it('should not crash on child observable sync completion during self-initialization', () => {
    const createEmptyObservable = (): Subscribable<any> => ({
      subscribe(observer) {
        (observer as Observer<any>).complete?.();

        return { unsubscribe: () => {} };
      }
    });

    const emptyObservableLogic = fromObservable(createEmptyObservable);

    const parentMachine = createMachine({
      // types: {} as {
      //   context: { child: ActorRefFrom<typeof emptyObservableLogic> | null };
      // },
      schemas: {
        context: z.object({
          child: z
            .object({
              send: z.function().args(z.any()).returns(z.any())
            })
            .nullable()
        })
      },
      context: {
        child: null
      },
      // entry: assign({
      //   child: ({ spawn }) => spawn(emptyObservableLogic)
      // })
      entry: (_, enq) => ({
        context: {
          child: enq.spawn(emptyObservableLogic)
        }
      })
    });
    const service = parentMachine.createActor();
    expect(() => {
      service.start();
    }).not.toThrow();
  });

  it('should receive done event from an immediately completed observable when self-initializing', () => {
    const emptyObservable = fromObservable(() => EMPTY);

    const parentMachine = createMachine({
      schemas: {
        context: z.object({
          child: z.custom<ActorRefFrom<typeof emptyObservable>>().nullable()
        })
      },
      context: {
        child: null
      },
      // entry: assign({
      //   child: ({ spawn }) => spawn(emptyObservable, { id: 'myactor' })
      // }),
      entry: (_, enq) => ({
        context: {
          child: enq.spawn(emptyObservable, { id: 'myactor' })
        }
      }),
      initial: 'init',
      states: {
        init: {
          on: {
            'xstate.done.actor.myactor': 'done'
          }
        },
        done: {}
      }
    });
    const service = parentMachine.createActor();

    service.start();

    expect(service.getSnapshot().value).toBe('done');
  });

  it('should not restart a completed observable', () => {
    let subscriptionCount = 0;
    const machine = createMachine({
      invoke: {
        id: 'observable',
        src: fromObservable(() => {
          subscriptionCount++;
          return of(42);
        })
      }
    });

    const actor = machine.createActor().start();
    const persistedState = actor.getPersistedSnapshot();

    machine
      .createActor(undefined, {
        snapshot: persistedState
      })
      .start();

    // Will be 2 if the observable is resubscribed
    expect(subscriptionCount).toBe(1);
  });

  it('should not restart a completed event observable', () => {
    let subscriptionCount = 0;
    const machine = createMachine({
      invoke: {
        id: 'observable',
        src: fromEventObservable(() => {
          subscriptionCount++;
          return of({ type: 'TEST' });
        })
      }
    });

    const actor = machine.createActor().start();
    const persistedState = actor.getPersistedSnapshot();

    machine
      .createActor(undefined, {
        snapshot: persistedState
      })
      .start();

    // Will be 2 if the event observable is resubscribed
    expect(subscriptionCount).toBe(1);
  });

  it('should be able to restart a spawned actor within a single macrostep', () => {
    const actual: string[] = [];
    let invokeCounter = 0;

    const machine = createMachine({
      // types: {} as {
      //   context: {
      //     actorRef: CallbackActorRef<EventObject>;
      //   };
      // },
      schemas: {
        context: z.object({
          actorRef: z.custom<CallbackActorRef<EventObject>>()
        })
      },
      initial: 'active',
      context: ({ spawn }) => {
        return {
          actorRef: spawn(
            fromCallback(() => {
              const localId = ++invokeCounter;
              actual.push(`start ${localId}`);
              return () => {
                actual.push(`stop ${localId}`);
              };
            }),
            { id: 'callback-1' }
          )
        };
      },
      states: {
        active: {
          on: {
            //   update: {
            //     actions: [
            //       stopChild(({ context }) => {
            //         return context.actorRef;
            //       }),
            //       assign({
            //         actorRef: ({ spawn }) => {
            //           const localId = ++invokeCounter;

            //           return spawn(
            //             fromCallback(() => {
            //               actual.push(`start ${localId}`);
            //               return () => {
            //                 actual.push(`stop ${localId}`);
            //               };
            //             }),
            //             { id: 'callback-2' }
            //           );
            //         }
            //       })
            //     ]
            //   }
            // }
            update: ({ context }, enq) => {
              enq.stop(context.actorRef);

              return {
                context: {
                  ...context,
                  actorRef: enq.spawn(
                    fromCallback(() => {
                      const localId = ++invokeCounter;
                      actual.push(`start ${localId}`);
                      return () => {
                        actual.push(`stop ${localId}`);
                      };
                    }),
                    { id: 'callback-2' }
                  )
                }
              };
            }
          }
        }
      }
    });

    const service = machine.createActor().start();

    actual.length = 0;

    service.send({
      type: 'update'
    });

    expect(actual).toEqual(['stop 1', 'start 2']);
  });

  it('should be able to restart a named spawned actor within a single macrostep when stopping by a ref', () => {
    const actual: string[] = [];
    let invokeCounter = 0;

    const machine = createMachine({
      // types: {} as {
      //   context: {
      //     actorRef: CallbackActorRef<EventObject>;
      //   };
      // },
      schemas: {
        context: z.object({
          actorRef: z.custom<CallbackActorRef<EventObject>>()
        })
      },
      initial: 'active',
      context: ({ spawn }) => {
        return {
          actorRef: spawn(
            fromCallback(() => {
              const localId = ++invokeCounter;
              actual.push(`start ${localId}`);
              return () => {
                actual.push(`stop ${localId}`);
              };
            }),
            { id: 'my_name' }
          )
        };
      },
      states: {
        active: {
          on: {
            // update: {
            //   actions: [
            //     stopChild(({ context }) => context.actorRef),
            //     assign({
            //       actorRef: ({ spawn }) => {
            //         const localId = ++invokeCounter;

            //         return spawn(
            //           fromCallback(() => {
            //             actual.push(`start ${localId}`);
            //             return () => {
            //               actual.push(`stop ${localId}`);
            //             };
            //           }),
            //           { id: 'my_name' }
            //         );
            //       }
            //     })
            //   ]
            // }
            update: ({ context }, enq) => {
              enq.stop(context.actorRef);

              return {
                context: {
                  ...context,
                  actorRef: enq.spawn(
                    fromCallback(() => {
                      const localId = ++invokeCounter;
                      actual.push(`start ${localId}`);
                      return () => {
                        actual.push(`stop ${localId}`);
                      };
                    }),
                    { id: 'my_name' }
                  )
                }
              };
            }
          }
        }
      }
    });

    const service = machine.createActor().start();

    actual.length = 0;

    service.send({
      type: 'update'
    });

    expect(actual).toEqual(['stop 1', 'start 2']);
  });

  it('should be able to restart a named spawned actor within a single macrostep when stopping by static name', () => {
    const actual: string[] = [];
    let invokeCounter = 0;

    const machine = createMachine({
      // types: {} as {
      //   context: {
      //     actorRef: CallbackActorRef<EventObject>;
      //   };
      // },
      schemas: {
        context: z.object({
          actorRef: z.custom<CallbackActorRef<EventObject>>()
        })
      },
      initial: 'active',
      context: ({ spawn }) => {
        return {
          actorRef: spawn(
            fromCallback(() => {
              const localId = ++invokeCounter;
              actual.push(`start ${localId}`);
              return () => {
                actual.push(`stop ${localId}`);
              };
            }),
            { id: 'my_name' }
          )
        };
      },
      states: {
        active: {
          on: {
            update: ({ context }, enq) => {
              enq.stop(context.actorRef);

              return {
                context: {
                  ...context,
                  actorRef: enq.spawn(
                    fromCallback(() => {
                      const localId = ++invokeCounter;
                      actual.push(`start ${localId}`);
                      return () => {
                        actual.push(`stop ${localId}`);
                      };
                    }),
                    { id: 'my_name' }
                  )
                }
              };
            }
          }
        }
      }
    });

    const service = machine.createActor().start();

    actual.length = 0;

    service.send({
      type: 'update'
    });

    expect(actual).toEqual(['stop 1', 'start 2']);
  });

  it('should be able to restart a named spawned actor within a single macrostep when stopping by resolved name', () => {
    const actual: string[] = [];
    let invokeCounter = 0;

    const machine = createMachine({
      // types: {} as {
      //   context: {
      //     actorRef: CallbackActorRef<EventObject>;
      //   };
      // },
      schemas: {
        context: z.object({
          actorRef: z.custom<CallbackActorRef<EventObject>>()
        })
      },
      initial: 'active',
      context: ({ spawn }) => {
        return {
          actorRef: spawn(
            fromCallback(() => {
              const localId = ++invokeCounter;
              actual.push(`start ${localId}`);
              return () => {
                actual.push(`stop ${localId}`);
              };
            }),
            { id: 'my_name' }
          )
        };
      },
      states: {
        active: {
          on: {
            update: ({ context }, enq) => {
              enq.stop(context.actorRef);

              return {
                context: {
                  ...context,
                  actorRef: enq.spawn(
                    fromCallback(() => {
                      const localId = ++invokeCounter;
                      actual.push(`start ${localId}`);
                      return () => {
                        actual.push(`stop ${localId}`);
                      };
                    }),
                    { id: 'my_name' }
                  )
                }
              };
            }
          }
        }
      }
    });

    const service = machine.createActor().start();

    actual.length = 0;

    service.send({
      type: 'update'
    });

    expect(actual).toEqual(['stop 1', 'start 2']);
  });

  it('should be possible to pass `self` as input to a child machine from within the context factory', () => {
    const spy = vi.fn();

    const child = createMachine({
      // types: {} as {
      //   context: {
      //     parent: AnyActorRef;
      //   };
      //   input: {
      //     parent: AnyActorRef;
      //   };
      // },
      schemas: {
        context: z.object({
          parent: z.custom<AnyActorRef>()
        }),
        input: z.object({
          parent: z.custom<AnyActorRef>()
        })
      },
      context: ({ input }) => ({
        parent: input.parent
      }),
      // entry: sendTo(({ context }) => context.parent, { type: 'GREET' })
      entry: ({ parent }, enq) => {
        enq.sendTo(parent, { type: 'GREET' });
      }
    });

    const machine = createMachine({
      schemas: {
        context: z.object({
          childRef: z.custom<ActorRefFrom<typeof child>>()
        })
      },
      context: ({ spawn, self }) => {
        return {
          childRef: spawn(child, { input: { parent: self } })
        };
      },
      on: {
        // GREET: {
        //   actions: spy
        // }
        GREET: (_, enq) => enq(spy)
      }
    });

    machine.createActor().start();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('catches errors from spawned promise actors', async () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    expect.assertions(1);
    const machine = createMachine({
      on: {
        event: (_, enq) => {
          enq.spawn(
            fromPromise(async () => {
              throw new Error('uh oh');
            })
          );
        }
      }
    });

    const actor = machine.createActor();
    actor.subscribe({
      error: (err) => {
        expect((err as Error).message).toBe('uh oh');
        resolve();
      }
    });
    actor.start();
    actor.send({ type: 'event' });

    await promise;
  });

  it('same-position invokes should not leak between machines', async () => {
    const spy = vi.fn();

    const sharedActors = {};

    const m1 = createMachine({
      invoke: {
        src: fromPromise(async () => 'foo'),
        // onDone: {
        //   actions: ({ event }) => spy(event.output)
        // }
        onDone: ({ event }, enq) => {
          enq(spy, event.output);
        }
      }
    }).provide({ actors: sharedActors });

    createMachine({
      invoke: { src: fromPromise(async () => 100) }
    }).provide({ actors: sharedActors });

    m1.createActor().start();

    await sleep(1);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('foo');
  });

  it('inline invokes should not leak into provided actors object', async () => {
    const actors = {};

    const machine = createMachine({
      actors,
      invoke: {
        src: fromPromise(async () => 'foo')
      }
    });

    machine.createActor().start();

    expect(actors).toEqual({});
  });
});
