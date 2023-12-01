import { EMPTY, interval, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { forwardTo, sendParent } from '../src/actions.ts';
import { assign } from '../src/actions/assign';
import { raise } from '../src/actions/raise';
import { sendTo } from '../src/actions/send';
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
  createMachine,
  waitFor,
  stopChild
} from '../src/index.ts';
import { setup } from '../src/setup.ts';
import { sleep } from '@xstate-repo/jest-utils';

describe('spawning machines', () => {
  const context = {
    todoRefs: {} as Record<string, ActorRef<any, any>>
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
    types: {} as {
      events: PingPongEvent;
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
        entry: [sendParent({ type: 'PONG' }), raise({ type: 'SUCCESS' })],
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
    types: {} as { context: ClientContext; events: PingPongEvent },
    id: 'client',
    initial: 'init',
    context: {
      server: undefined
    },
    states: {
      init: {
        entry: [
          assign({
            server: ({ spawn }) => spawn(serverMachine)
          }),
          raise({ type: 'SUCCESS' })
        ],
        on: {
          SUCCESS: 'sendPing'
        }
      },
      sendPing: {
        entry: [
          sendTo(({ context }) => context.server!, { type: 'PING' }),
          raise({ type: 'SUCCESS' })
        ],
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

  it('should spawn machines', (done) => {
    const todoMachine = createMachine({
      id: 'todo',
      initial: 'incomplete',
      states: {
        incomplete: {
          on: { SET_COMPLETE: 'complete' }
        },
        complete: {
          entry: sendParent({ type: 'TODO_COMPLETED' })
        }
      }
    });

    const todosMachine = createMachine({
      types: {} as {
        context: typeof context;
        events: TodoEvent;
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
        ADD: {
          actions: assign({
            todoRefs: ({ context, event, spawn }) => ({
              ...context.todoRefs,
              [event.id]: spawn(todoMachine)
            })
          })
        },
        SET_COMPLETE: {
          actions: sendTo(
            ({ context, event }) => {
              return context.todoRefs[
                (event as Extract<TodoEvent, { type: 'SET_COMPLETE' }>).id
              ];
            },
            { type: 'SET_COMPLETE' }
          )
        }
      }
    });
    const service = createActor(todosMachine);
    service.subscribe({
      complete: () => {
        done();
      }
    });
    service.start();

    service.send({ type: 'ADD', id: 42 });
    service.send({ type: 'SET_COMPLETE', id: 42 });
  });

  it('should spawn referenced machines', () => {
    const childMachine = createMachine({
      entry: sendParent({ type: 'DONE' })
    });

    const parentMachine = createMachine(
      {
        context: {
          ref: null! as ActorRef<any, any>
        },
        initial: 'waiting',
        states: {
          waiting: {
            entry: assign({
              ref: ({ spawn }) => spawn('child')
            }),
            on: {
              DONE: 'success'
            }
          },
          success: {
            type: 'final'
          }
        }
      },
      {
        actors: {
          child: childMachine
        }
      }
    );

    const actor = createActor(parentMachine);
    actor.start();
    expect(actor.getSnapshot().value).toBe('success');
  });

  it('should allow bidirectional communication between parent/child actors', (done) => {
    const actor = createActor(clientMachine);
    actor.subscribe({
      complete: () => {
        done();
      }
    });
    actor.start();
  });
});

const aaa = 'dadasda';

describe('spawning promises', () => {
  it('should be able to spawn a promise', (done) => {
    const promiseMachine = createMachine({
      types: {} as {
        context: { promiseRef?: PromiseActorRef<string> };
      },
      id: 'promise',
      initial: 'idle',
      context: {
        promiseRef: undefined
      },
      states: {
        idle: {
          entry: assign({
            promiseRef: ({ spawn }) => {
              const ref = spawn(
                fromPromise(
                  () =>
                    new Promise<string>((res) => {
                      res('response');
                    })
                ),
                { id: 'my-promise' }
              );

              return ref;
            }
          }),
          on: {
            'xstate.done.actor.my-promise': {
              target: 'success',
              guard: ({ event }) => event.output === 'response'
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const promiseService = createActor(promiseMachine);
    promiseService.subscribe({
      complete: () => {
        done();
      }
    });

    promiseService.start();
  });

  it('should be able to spawn a referenced promise', (done) => {
    const promiseMachine = setup({
      actors: {
        somePromise: fromPromise(
          () =>
            new Promise<string>((res) => {
              res('response');
            })
        )
      }
    }).createMachine({
      types: {} as {
        context: { promiseRef?: PromiseActorRef<string> };
      },
      id: 'promise',
      initial: 'idle',
      context: {
        promiseRef: undefined
      },
      states: {
        idle: {
          entry: assign({
            promiseRef: ({ spawn }) =>
              spawn('somePromise', { id: 'my-promise' })
          }),
          on: {
            'xstate.done.actor.my-promise': {
              target: 'success',
              guard: ({ event }) => event.output === 'response'
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const promiseService = createActor(promiseMachine);
    promiseService.subscribe({
      complete: () => {
        done();
      }
    });

    promiseService.start();
  });
});

describe('spawning callbacks', () => {
  it('should be able to spawn an actor from a callback', (done) => {
    const callbackMachine = createMachine({
      types: {} as {
        context: {
          callbackRef?: CallbackActorRef<{ type: 'START' }>;
        };
      },
      id: 'callback',
      initial: 'idle',
      context: {
        callbackRef: undefined
      },
      states: {
        idle: {
          entry: assign({
            callbackRef: ({ spawn }) =>
              spawn(
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
          }),
          on: {
            START_CB: {
              actions: sendTo(({ context }) => context.callbackRef!, {
                type: 'START'
              })
            },
            SEND_BACK: 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const callbackService = createActor(callbackMachine);
    callbackService.subscribe({
      complete: () => {
        done();
      }
    });

    callbackService.start();
    callbackService.send({ type: 'START_CB' });
  });

  it('should not deliver events sent to the parent after the callback actor gets stopped', () => {
    const spy = jest.fn();

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
        FROM_CALLBACK: {
          actions: spy
        }
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'NEXT' });

    sendToParent!();

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('spawning observables', () => {
  it('should spawn an observable', (done) => {
    const observableLogic = fromObservable(() => interval(10));
    const observableMachine = createMachine({
      id: 'observable',
      initial: 'idle',
      context: {
        observableRef: undefined! as ActorRefFrom<typeof observableLogic>
      },
      states: {
        idle: {
          entry: assign({
            observableRef: ({ spawn }) => {
              const ref = spawn(observableLogic, {
                id: 'int',
                syncSnapshot: true
              });

              return ref;
            }
          }),
          on: {
            'xstate.snapshot.int': {
              target: 'success',
              guard: ({ event }) => event.snapshot.context === 5
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const observableService = createActor(observableMachine);
    observableService.subscribe({
      complete: () => {
        done();
      }
    });

    observableService.start();
  });

  it('should spawn a referenced observable', (done) => {
    const observableMachine = createMachine(
      {
        id: 'observable',
        initial: 'idle',
        context: {
          observableRef: undefined! as ActorRef<any, any>
        },
        states: {
          idle: {
            entry: assign({
              observableRef: ({ spawn }) =>
                spawn('interval', { id: 'int', syncSnapshot: true })
            }),
            on: {
              'xstate.snapshot.int': {
                target: 'success',
                guard: ({ event }) => event.snapshot.context === 5
              }
            }
          },
          success: {
            type: 'final'
          }
        }
      },
      {
        actors: {
          interval: fromObservable(() => interval(10))
        }
      }
    );

    const observableService = createActor(observableMachine);
    observableService.subscribe({
      complete: () => {
        done();
      }
    });

    observableService.start();
  });

  it(`should read the latest snapshot of the event's origin while handling that event`, (done) => {
    const observableLogic = fromObservable(() => interval(10));
    const observableMachine = createMachine({
      id: 'observable',
      initial: 'idle',
      context: {
        observableRef: undefined! as ActorRefFrom<typeof observableLogic>
      },
      states: {
        idle: {
          entry: assign({
            observableRef: ({ spawn }) => {
              const ref = spawn(observableLogic, {
                id: 'int',
                syncSnapshot: true
              });

              return ref;
            }
          }),
          on: {
            'xstate.snapshot.int': {
              target: 'success',
              guard: ({ context, event }) => {
                return (
                  event.snapshot.context === 1 &&
                  context.observableRef.getSnapshot().context === 1
                );
              }
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const observableService = createActor(observableMachine);
    observableService.subscribe({
      complete: () => {
        done();
      }
    });

    observableService.start();
  });

  it('should notify direct child listeners with final snapshot before it gets stopped', async () => {
    const intervalActor = fromObservable(() => interval(10));

    const parentMachine = createMachine(
      {
        types: {} as {
          actors: {
            src: 'interval';
            id: 'childActor';
            logic: typeof intervalActor;
          };
        },
        initial: 'active',
        states: {
          active: {
            invoke: {
              id: 'childActor',
              src: 'interval',
              onSnapshot: {
                target: 'success',
                guard: ({ event }) => {
                  return event.snapshot.context === 3;
                }
              }
            }
          },
          success: {
            type: 'final'
          }
        }
      },
      {
        actors: {
          interval: intervalActor
        }
      }
    );

    const actorRef = createActor(parentMachine);
    actorRef.start();

    await waitFor(actorRef, (state) => state.matches('active'));

    const spy = jest.fn();

    actorRef.getSnapshot().children.childActor!.subscribe((data) => {
      spy(data.context);
    });

    await waitFor(actorRef, (state) => state.status !== 'active');

    expect(spy).toHaveBeenCalledWith(3);
  });

  it('should not notify direct child listeners after it gets stopped', async () => {
    const intervalActor = fromObservable(() => interval(10));

    const parentMachine = createMachine(
      {
        types: {} as {
          actors: {
            src: 'interval';
            id: 'childActor';
            logic: typeof intervalActor;
          };
        },
        initial: 'active',
        states: {
          active: {
            invoke: {
              id: 'childActor',
              src: 'interval',
              onSnapshot: {
                target: 'success',
                guard: ({ event }) => {
                  return event.snapshot.context === 3;
                }
              }
            }
          },
          success: {
            type: 'final'
          }
        }
      },
      {
        actors: {
          interval: intervalActor
        }
      }
    );

    const actorRef = createActor(parentMachine);
    actorRef.start();

    await waitFor(actorRef, (state) => state.matches('active'));

    const spy = jest.fn();

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
  it('should spawn an event observable', (done) => {
    const eventObservableLogic = fromEventObservable(() =>
      interval(10).pipe(map((val) => ({ type: 'COUNT', val })))
    );
    const observableMachine = createMachine({
      id: 'observable',
      initial: 'idle',
      context: {
        observableRef: undefined! as ActorRefFrom<typeof eventObservableLogic>
      },
      states: {
        idle: {
          entry: assign({
            observableRef: ({ spawn }) => {
              const ref = spawn(eventObservableLogic, { id: 'int' });

              return ref;
            }
          }),
          on: {
            COUNT: {
              target: 'success',
              guard: ({ event }) => event.val === 5
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const observableService = createActor(observableMachine);
    observableService.subscribe({
      complete: () => {
        done();
      }
    });

    observableService.start();
  });

  it('should spawn a referenced event observable', (done) => {
    const observableMachine = createMachine(
      {
        id: 'observable',
        initial: 'idle',
        context: {
          observableRef: undefined! as ActorRef<any, any>
        },
        states: {
          idle: {
            entry: assign({
              observableRef: ({ spawn }) => spawn('interval', { id: 'int' })
            }),
            on: {
              COUNT: {
                target: 'success',
                guard: ({ event }) => event.val === 5
              }
            }
          },
          success: {
            type: 'final'
          }
        }
      },
      {
        actors: {
          interval: fromEventObservable(() =>
            interval(10).pipe(map((val) => ({ type: 'COUNT', val })))
          )
        }
      }
    );

    const observableService = createActor(observableMachine);
    observableService.subscribe({
      complete: () => {
        done();
      }
    });

    observableService.start();
  });
});

describe('communicating with spawned actors', () => {
  it('should treat an interpreter as an actor', (done) => {
    const existingMachine = createMachine({
      types: {
        events: {} as {
          type: 'ACTIVATE';
          origin: AnyActorRef;
        }
      },
      initial: 'inactive',
      states: {
        inactive: {
          on: { ACTIVATE: 'active' }
        },
        active: {
          entry: sendTo(({ event }) => event.origin, { type: 'EXISTING.DONE' })
        }
      }
    });

    const existingService = createActor(existingMachine).start();

    const parentMachine = createMachine({
      types: {} as {
        context: { existingRef?: typeof existingService };
      },
      initial: 'pending',
      context: {
        existingRef: undefined
      },
      states: {
        pending: {
          entry: assign({
            // No need to spawn an existing service:
            existingRef: existingService
          }),
          on: {
            'EXISTING.DONE': 'success'
          },
          after: {
            100: {
              actions: sendTo(
                ({ context }) => context.existingRef!,
                ({ self }) => ({
                  type: 'ACTIVATE',
                  origin: self
                })
              )
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const parentService = createActor(parentMachine);
    parentService.subscribe({
      complete: () => {
        done();
      }
    });

    parentService.start();
  });
});

describe('actors', () => {
  it('should only spawn actors defined on initial state once', () => {
    let count = 0;

    const startMachine = createMachine({
      types: {} as { context: { items: number[]; refs: any[] } },
      id: 'start',
      initial: 'start',
      context: {
        items: [0, 1, 2, 3],
        refs: []
      },
      states: {
        start: {
          entry: assign({
            refs: ({ context, spawn }) => {
              count++;
              const c = context.items.map((item) =>
                spawn(fromPromise(() => new Promise((res) => res(item))))
              );

              return c;
            }
          })
        }
      }
    });

    const actor = createActor(startMachine);
    actor.subscribe(() => {
      expect(count).toEqual(1);
    });
    actor.start();
  });

  it('should spawn an actor in an initial state of a child that gets invoked in the initial state of a parent when the parent gets started', () => {
    let spawnCounter = 0;

    interface TestContext {
      promise?: ActorRefFrom<PromiseActorLogic<string>>;
    }

    const child = createMachine({
      types: {} as { context: TestContext },
      initial: 'bar',
      context: {},
      states: {
        bar: {
          entry: assign({
            promise: ({ spawn }) => {
              return spawn(
                fromPromise(() => {
                  spawnCounter++;
                  return Promise.resolve('answer');
                })
              );
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
    createActor(parent).start();
    expect(spawnCounter).toBe(1);
  });

  // https://github.com/statelyai/xstate/issues/2565
  it('should only spawn an initial actor once when it synchronously responds with an event', () => {
    let spawnCalled = 0;
    const anotherMachine = createMachine({
      initial: 'hello',
      states: {
        hello: {
          entry: sendParent({ type: 'ping' })
        }
      }
    });

    const testMachine = createMachine({
      types: {} as { context: { ref?: ActorRefFrom<typeof anotherMachine> } },
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

    const service = createActor(testMachine).start();
    expect(service.getSnapshot().value).toEqual('done');
  });

  it('should spawn null actors if not used within a service', () => {
    const nullActorMachine = createMachine({
      types: {} as { context: { ref?: PromiseActorRef<number> } },
      initial: 'foo',
      context: { ref: undefined },
      states: {
        foo: {
          entry: assign({
            ref: ({ spawn }) => spawn(fromPromise(() => Promise.resolve(42)))
          })
        }
      }
    });

    // expect(createActor(nullActorMachine).getSnapshot().context.ref!.id).toBe('null'); // TODO: identify null actors
    expect(
      createActor(nullActorMachine).getSnapshot().context.ref!.send
    ).toBeDefined();
  });

  it('should stop multiple inline spawned actors that have no explicit ids', () => {
    const cleanup1 = jest.fn();
    const cleanup2 = jest.fn();

    const parent = createMachine({
      context: ({ spawn }) => ({
        ref1: spawn(fromCallback(() => cleanup1)),
        ref2: spawn(fromCallback(() => cleanup2))
      })
    });
    const actorRef = createActor(parent).start();

    expect(Object.keys(actorRef.getSnapshot().children).length).toBe(2);

    actorRef.stop();

    expect(cleanup1).toBeCalledTimes(1);
    expect(cleanup2).toBeCalledTimes(1);
  });

  it('should stop multiple referenced spawned actors that have no explicit ids', () => {
    const cleanup1 = jest.fn();
    const cleanup2 = jest.fn();

    const parent = createMachine(
      {
        context: ({ spawn }) => ({
          ref1: spawn('child1'),
          ref2: spawn('child2')
        })
      },
      {
        actors: {
          child1: fromCallback(() => cleanup1),
          child2: fromCallback(() => cleanup2)
        }
      }
    );
    const actorRef = createActor(parent).start();

    expect(Object.keys(actorRef.getSnapshot().children).length).toBe(2);

    actorRef.stop();

    expect(cleanup1).toBeCalledTimes(1);
    expect(cleanup2).toBeCalledTimes(1);
  });

  describe('with actor logic', () => {
    it('should work with a transition function logic', (done) => {
      const countLogic = fromTransition((count: number, event: any) => {
        if (event.type === 'INC') {
          return count + 1;
        } else if (event.type === 'DEC') {
          return count - 1;
        }
        return count;
      }, 0);

      const countMachine = createMachine({
        types: {} as {
          context: { count: ActorRefFrom<typeof countLogic> | undefined };
        },
        context: {
          count: undefined
        },
        entry: assign({
          count: ({ spawn }) => spawn(countLogic)
        }),
        on: {
          INC: {
            actions: forwardTo(({ context }) => context.count!)
          }
        }
      });

      const countService = createActor(countMachine);
      countService.subscribe((state) => {
        if (state.context.count?.getSnapshot().context === 2) {
          done();
        }
      });
      countService.start();

      countService.send({ type: 'INC' });
      countService.send({ type: 'INC' });

      expect(
        countService.getSnapshot().context.count?.getSnapshot().context
      ).toBe(2);
    });

    it('should work with a promise logic (fulfill)', (done) => {
      const countMachine = createMachine({
        types: {} as {
          context: {
            count: ActorRefFrom<PromiseActorLogic<number>> | undefined;
          };
        },
        context: {
          count: undefined
        },
        entry: assign({
          count: ({ spawn }) =>
            spawn(
              fromPromise(
                () =>
                  new Promise<number>((res) => {
                    setTimeout(() => res(42));
                  })
              ),
              { id: 'test' }
            )
        }),
        initial: 'pending',
        states: {
          pending: {
            on: {
              'xstate.done.actor.test': {
                target: 'success',
                guard: ({ event }) => event.output === 42
              }
            }
          },
          success: {
            type: 'final'
          }
        }
      });

      const countService = createActor(countMachine);
      countService.subscribe({
        complete: () => {
          done();
        }
      });
      countService.start();
    });

    it('should work with a promise logic (reject)', (done) => {
      const errorMessage = 'An error occurred';
      const countMachine = createMachine({
        types: {} as {
          context: { count: ActorRefFrom<PromiseActorLogic<number>> };
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
              'xstate.error.actor.test': {
                target: 'success',
                guard: ({ event }) => {
                  return event.error === errorMessage;
                }
              }
            }
          },
          success: {
            type: 'final'
          }
        }
      });

      const countService = createActor(countMachine);
      countService.subscribe({
        complete: () => {
          done();
        }
      });
      countService.start();
    });

    it('actor logic should have reference to the parent', (done) => {
      const pongLogic: ActorLogic<Snapshot<undefined>, EventObject> = {
        transition: (state, event, { self }) => {
          if (event.type === 'PING') {
            self._parent?.send({ type: 'PONG' });
          }

          return state;
        },
        getInitialState: () => ({
          status: 'active',
          output: undefined,
          error: undefined
        }),
        getPersistedSnapshot: (s) => s
      };

      const pingMachine = createMachine({
        types: {} as {
          context: { ponger: ActorRefFrom<typeof pongLogic> | undefined };
        },
        initial: 'waiting',
        context: {
          ponger: undefined
        },
        entry: assign({
          ponger: ({ spawn }) => spawn(pongLogic)
        }),
        states: {
          waiting: {
            entry: sendTo(({ context }) => context.ponger!, { type: 'PING' }),
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

      const pingService = createActor(pingMachine);
      pingService.subscribe({
        complete: () => {
          done();
        }
      });
      pingService.start();
    });
  });

  it('should be able to spawn callback actors in (lazy) initial context', (done) => {
    const machine = createMachine({
      types: {} as { context: { ref: CallbackActorRef<EventObject> } },
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

    const actor = createActor(machine);
    actor.subscribe({
      complete: () => {
        done();
      }
    });
    actor.start();
  });

  it('should be able to spawn machines in (lazy) initial context', (done) => {
    const childMachine = createMachine({
      entry: sendParent({ type: 'TEST' })
    });

    const machine = createMachine({
      types: {} as { context: { ref: ActorRefFrom<typeof childMachine> } },
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

    const actor = createActor(machine);
    actor.subscribe({
      complete: () => {
        done();
      }
    });
    actor.start();
  });

  // https://github.com/statelyai/xstate/issues/2507
  it('should not crash on child machine sync completion during self-initialization', () => {
    const childMachine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          always: [
            {
              target: 'stopped'
            }
          ]
        },
        stopped: {
          type: 'final'
        }
      }
    });

    const parentMachine = createMachine(
      {
        types: {} as {
          context: { child: ActorRefFrom<typeof childMachine> | null };
        },
        context: {
          child: null
        },
        entry: 'setup'
      },
      {
        actions: {
          setup: assign({
            child: ({ spawn }) => spawn(childMachine)
          })
        }
      }
    );
    const service = createActor(parentMachine);
    expect(() => {
      service.start();
    }).not.toThrow();
  });

  it('should not crash on child promise-like sync completion during self-initialization', () => {
    const promiseLogic = fromPromise(
      () => ({ then: (fn: any) => fn(null) }) as any
    );
    const parentMachine = createMachine({
      types: {} as {
        context: { child: ActorRefFrom<typeof promiseLogic> | null };
      },
      context: {
        child: null
      },
      entry: assign({
        child: ({ spawn }) => spawn(promiseLogic)
      })
    });
    const service = createActor(parentMachine);
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
      types: {} as {
        context: { child: ActorRefFrom<typeof emptyObservableLogic> | null };
      },
      context: {
        child: null
      },
      entry: assign({
        child: ({ spawn }) => spawn(emptyObservableLogic)
      })
    });
    const service = createActor(parentMachine);
    expect(() => {
      service.start();
    }).not.toThrow();
  });

  it('should receive done event from an immediately completed observable when self-initializing', () => {
    const emptyObservable = fromObservable(() => EMPTY);

    const parentMachine = createMachine({
      types: {
        context: {} as {
          child: ActorRefFrom<typeof emptyObservable> | null;
        }
      },
      context: {
        child: null
      },
      entry: assign({
        child: ({ spawn }) => spawn(emptyObservable, { id: 'myactor' })
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
    const service = createActor(parentMachine);

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

    const actor = createActor(machine).start();
    const persistedState = actor.getPersistedSnapshot();

    createActor(machine, {
      snapshot: persistedState
    }).start();

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

    const actor = createActor(machine).start();
    const persistedState = actor.getPersistedSnapshot();

    createActor(machine, {
      snapshot: persistedState
    }).start();

    // Will be 2 if the event observable is resubscribed
    expect(subscriptionCount).toBe(1);
  });

  it('should be able to restart a spawned actor within a single macrostep', () => {
    const actual: string[] = [];
    let invokeCounter = 0;

    const machine = createMachine({
      types: {} as {
        context: {
          actorRef: CallbackActorRef<EventObject>;
        };
      },
      initial: 'active',
      context: ({ spawn }) => {
        const localId = ++invokeCounter;

        return {
          actorRef: spawn(
            fromCallback(() => {
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
            update: {
              actions: [
                stopChild(({ context }) => {
                  return context.actorRef;
                }),
                assign({
                  actorRef: ({ spawn }) => {
                    const localId = ++invokeCounter;

                    return spawn(
                      fromCallback(() => {
                        actual.push(`start ${localId}`);
                        return () => {
                          actual.push(`stop ${localId}`);
                        };
                      }),
                      { id: 'callback-2' }
                    );
                  }
                })
              ]
            }
          }
        }
      }
    });

    const service = createActor(machine).start();

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
      types: {} as {
        context: {
          actorRef: CallbackActorRef<EventObject>;
        };
      },
      initial: 'active',
      context: ({ spawn }) => {
        const localId = ++invokeCounter;

        return {
          actorRef: spawn(
            fromCallback(() => {
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
            update: {
              actions: [
                stopChild(({ context }) => context.actorRef),
                assign({
                  actorRef: ({ spawn }) => {
                    const localId = ++invokeCounter;

                    return spawn(
                      fromCallback(() => {
                        actual.push(`start ${localId}`);
                        return () => {
                          actual.push(`stop ${localId}`);
                        };
                      }),
                      { id: 'my_name' }
                    );
                  }
                })
              ]
            }
          }
        }
      }
    });

    const service = createActor(machine).start();

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
      types: {} as {
        context: {
          actorRef: CallbackActorRef<EventObject>;
        };
      },
      initial: 'active',
      context: ({ spawn }) => {
        const localId = ++invokeCounter;

        return {
          actorRef: spawn(
            fromCallback(() => {
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
            update: {
              actions: [
                stopChild('my_name'),
                assign({
                  actorRef: ({ spawn }) => {
                    const localId = ++invokeCounter;

                    return spawn(
                      fromCallback(() => {
                        actual.push(`start ${localId}`);
                        return () => {
                          actual.push(`stop ${localId}`);
                        };
                      }),
                      { id: 'my_name' }
                    );
                  }
                })
              ]
            }
          }
        }
      }
    });

    const service = createActor(machine).start();

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
      types: {} as {
        context: {
          actorRef: CallbackActorRef<EventObject>;
        };
      },
      initial: 'active',
      context: ({ spawn }) => {
        const localId = ++invokeCounter;
        actual.push(`start ${localId}`);

        return {
          actorRef: spawn(
            fromCallback(() => {
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
            update: {
              actions: [
                stopChild(() => 'my_name'),
                assign({
                  actorRef: ({ spawn }) => {
                    const localId = ++invokeCounter;

                    return spawn(
                      fromCallback(() => {
                        actual.push(`start ${localId}`);
                        return () => {
                          actual.push(`stop ${localId}`);
                        };
                      }),
                      { id: 'my_name' }
                    );
                  }
                })
              ]
            }
          }
        }
      }
    });

    const service = createActor(machine).start();

    actual.length = 0;

    service.send({
      type: 'update'
    });

    expect(actual).toEqual(['stop 1', 'start 2']);
  });
});
