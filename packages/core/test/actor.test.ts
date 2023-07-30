import {
  interpret,
  createMachine,
  ActorRef,
  ActorRefFrom,
  EventObject,
  ActorLogic,
  Subscribable,
  Observer,
  AnyActorRef
} from '../src/index.ts';
import { sendParent, doneInvoke, forwardTo, error } from '../src/actions.ts';
import { raise } from '../src/actions/raise';
import { assign } from '../src/actions/assign';
import { sendTo } from '../src/actions/send';
import { EMPTY, interval, of } from 'rxjs';
import { fromTransition } from '../src/actors/transition.ts';
import {
  fromObservable,
  fromEventObservable
} from '../src/actors/observable.ts';
import { fromPromise } from '../src/actors/promise.ts';
import { fromCallback } from '../src/actors/callback.ts';
import { map } from 'rxjs/operators';

describe('spawning machines', () => {
  const context = {
    todoRefs: {} as Record<string, ActorRef<any>>
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
    server?: ActorRef<PingPongEvent>;
  }

  const clientMachine = createMachine<ClientContext, PingPongEvent>({
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

    const todosMachine = createMachine<typeof context, TodoEvent>({
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
    const service = interpret(todosMachine);
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

    const actor = interpret(parentMachine);
    actor.start();
    expect(actor.getSnapshot().value).toBe('success');
  });

  it('should allow bidirectional communication between parent/child actors', (done) => {
    const actor = interpret(clientMachine);
    actor.subscribe({
      complete: () => {
        done();
      }
    });
    actor.start();
  });
});

describe('spawning promises', () => {
  it('should be able to spawn a promise', (done) => {
    const promiseMachine = createMachine<{ promiseRef?: ActorRef<any> }>({
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
            [doneInvoke('my-promise')]: {
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

    const promiseService = interpret(promiseMachine);
    promiseService.subscribe({
      complete: () => {
        done();
      }
    });

    promiseService.start();
  });

  it('should be able to spawn a referenced promise', (done) => {
    const promiseMachine = createMachine<{ promiseRef?: ActorRef<any> }>(
      {
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
              [doneInvoke('my-promise')]: {
                target: 'success',
                guard: ({ event }) => event.output === 'response'
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
          somePromise: fromPromise(
            () =>
              new Promise((res) => {
                res('response');
              })
          )
        }
      }
    );

    const promiseService = interpret(promiseMachine);
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
    const callbackMachine = createMachine<{ callbackRef?: ActorRef<any> }>({
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
                fromCallback(({ sendBack, receive }) => {
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

    const callbackService = interpret(callbackMachine);
    callbackService.subscribe({
      complete: () => {
        done();
      }
    });

    callbackService.start();
    callbackService.send({ type: 'START_CB' });
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
              const ref = spawn(observableLogic, { id: 'int' });

              return ref;
            }
          }),
          on: {
            'xstate.snapshot.int': {
              target: 'success',
              guard: ({ event }) => event.data === 5
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const observableService = interpret(observableMachine);
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
              observableRef: ({ spawn }) => spawn('interval', { id: 'int' })
            }),
            on: {
              'xstate.snapshot.int': {
                target: 'success',
                guard: ({ event }) => event.data === 5
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

    const observableService = interpret(observableMachine);
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
              const ref = spawn(observableLogic, { id: 'int' });

              return ref;
            }
          }),
          on: {
            'xstate.snapshot.int': {
              target: 'success',
              guard: ({ context, event }) => {
                return (
                  event.data === 1 && context.observableRef.getSnapshot() === 1
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

    const observableService = interpret(observableMachine);
    observableService.subscribe({
      complete: () => {
        done();
      }
    });

    observableService.start();
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

    const observableService = interpret(observableMachine);
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

    const observableService = interpret(observableMachine);
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

    const existingService = interpret(existingMachine).start();

    const parentMachine = createMachine<{
      existingRef?: ActorRef<any>;
    }>({
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

    const parentService = interpret(parentMachine);
    parentService.subscribe({
      complete: () => {
        done();
      }
    });

    parentService.start();
  });

  it.skip('should be able to name existing actors', (done) => {
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

    const existingService = interpret(existingMachine).start();

    const parentMachine = createMachine<{
      existingRef: ActorRef<any> | undefined;
    }>({
      initial: 'pending',
      context: {
        existingRef: undefined
      },
      states: {
        pending: {
          entry: assign({
            // TODO: fix (spawn existing service)
            // @ts-ignore
            existingRef: () => spawn(existingService, 'existing')
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

    const parentService = interpret(parentMachine);
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

    const startMachine = createMachine<{
      items: number[];
      refs: any[];
    }>({
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

    const actor = interpret(startMachine);
    actor.subscribe(() => {
      expect(count).toEqual(1);
    });
    actor.start();
  });

  it('should only spawn an actor in an initial state of a child that gets invoked in the initial state of a parent when the parent gets started', () => {
    let spawnCounter = 0;

    interface TestContext {
      promise?: ActorRefFrom<Promise<string>>;
    }

    const child = createMachine<TestContext>({
      initial: 'bar',
      context: {},
      states: {
        bar: {
          entry: assign<TestContext>({
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
    interpret(parent).start();
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

    const testMachine = createMachine<{ ref: ActorRef<any> }>({
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

    const service = interpret(testMachine).start();
    expect(service.getSnapshot().value).toEqual('done');
  });

  it('should spawn null actors if not used within a service', () => {
    const nullActorMachine = createMachine<{ ref?: ActorRef<any> }>({
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

    // expect(interpret(nullActorMachine).getSnapshot().context.ref!.id).toBe('null'); // TODO: identify null actors
    expect(
      interpret(nullActorMachine).getSnapshot().context.ref!.send
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
    const actorRef = interpret(parent).start();

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
    const actorRef = interpret(parent).start();

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

      const countMachine = createMachine<{
        count: ActorRefFrom<typeof countLogic> | undefined;
      }>({
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

      const countService = interpret(countMachine);
      countService.subscribe((state) => {
        if (state.context.count?.getSnapshot() === 2) {
          done();
        }
      });
      countService.start();

      countService.send({ type: 'INC' });
      countService.send({ type: 'INC' });
    });

    it('should work with a promise logic (fulfill)', (done) => {
      const countMachine = createMachine<{
        count: ActorRefFrom<Promise<number>> | undefined;
      }>({
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
              'done.invoke.test': {
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

      const countService = interpret(countMachine);
      countService.subscribe({
        complete: () => {
          done();
        }
      });
      countService.start();
    });

    it('should work with a promise logic (reject)', (done) => {
      const errorMessage = 'An error occurred';
      const countMachine = createMachine<{
        count: ActorRefFrom<Promise<number>>;
      }>({
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
              [error('test')]: {
                target: 'success',
                guard: ({ event }) => {
                  return event.data === errorMessage;
                }
              }
            }
          },
          success: {
            type: 'final'
          }
        }
      });

      const countService = interpret(countMachine);
      countService.subscribe({
        complete: () => {
          done();
        }
      });
      countService.start();
    });

    it('actor logic should have reference to the parent', (done) => {
      const pongLogic: ActorLogic<EventObject, undefined> = {
        transition: (_state, event, { self }) => {
          if (event.type === 'PING') {
            self._parent?.send({ type: 'PONG' });
          }

          return undefined;
        },
        getInitialState: () => undefined
      };

      const pingMachine = createMachine<{
        ponger: ActorRefFrom<typeof pongLogic> | undefined;
      }>({
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

      const pingService = interpret(pingMachine);
      pingService.subscribe({
        complete: () => {
          done();
        }
      });
      pingService.start();
    });
  });

  it('should be able to spawn callback actors in (lazy) initial context', (done) => {
    const machine = createMachine<{ ref: ActorRef<any> }>({
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

    const actor = interpret(machine);
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

    const machine = createMachine<{ ref: ActorRef<any> }>({
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

    const actor = interpret(machine);
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

    const parentMachine = createMachine<{
      child: ActorRefFrom<typeof childMachine> | null;
    }>(
      {
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
    const service = interpret(parentMachine);
    expect(() => {
      service.start();
    }).not.toThrow();
  });

  it('should not crash on child promise-like sync completion during self-initialization', () => {
    const parentMachine = createMachine<{
      child: ActorRef<never, any> | null;
    }>({
      context: {
        child: null
      },
      entry: assign({
        child: ({ spawn }) =>
          spawn(fromPromise(() => ({ then: (fn: any) => fn(null) } as any)))
      })
    });
    const service = interpret(parentMachine);
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

    const parentMachine = createMachine<{
      child: ActorRef<never, any> | null;
    }>({
      context: {
        child: null
      },
      entry: assign({
        child: ({ spawn }) => spawn(fromObservable(createEmptyObservable))
      })
    });
    const service = interpret(parentMachine);
    expect(() => {
      service.start();
    }).not.toThrow();
  });

  it('should receive done event from an immediately completed observable when self-initializing', () => {
    const parentMachine = createMachine<{
      child: ActorRef<EventObject, unknown> | null;
    }>({
      context: {
        child: null
      },
      entry: assign({
        child: ({ spawn }) =>
          spawn(
            fromObservable(() => EMPTY),
            { id: 'myactor' }
          )
      }),
      initial: 'init',
      states: {
        init: {
          on: {
            'done.invoke.myactor': 'done'
          }
        },
        done: {}
      }
    });
    const service = interpret(parentMachine);

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

    const actor = interpret(machine).start();
    const persistedState = actor.getPersistedState();

    interpret(machine, {
      state: persistedState
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

    const actor = interpret(machine).start();
    const persistedState = actor.getPersistedState();

    interpret(machine, {
      state: persistedState
    }).start();

    // Will be 2 if the event observable is resubscribed
    expect(subscriptionCount).toBe(1);
  });
});
