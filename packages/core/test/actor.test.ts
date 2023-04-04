import {
  interpret,
  createMachine,
  ActorRef,
  ActorRefFrom,
  EventObject,
  ActorBehavior,
  Subscribable,
  Observer,
  toSCXMLEvent
} from '../src/index.js';
import {
  sendParent,
  doneInvoke,
  respond,
  forwardTo,
  error
} from '../src/actions';
import { raise } from '../src/actions/raise';
import { assign } from '../src/actions/assign';
import { sendTo } from '../src/actions/send';
import { EMPTY, interval, of } from 'rxjs';
import { fromTransition } from '../src/actors/transition.js';
import { fromObservable, fromEventObservable } from '../src/actors/observable';
import { fromPromise } from '../src/actors/promise';
import { fromCallback } from '../src/actors/callback';
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

  const serverMachine = createMachine<any, PingPongEvent>({
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
            server: (_, __, { spawn }) => spawn(serverMachine)
          }),
          raise({ type: 'SUCCESS' })
        ],
        on: {
          SUCCESS: 'sendPing'
        }
      },
      sendPing: {
        entry: [
          sendTo((ctx) => ctx.server!, { type: 'PING' }),
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
            todoRefs: (ctx, e, { spawn }) => ({
              ...ctx.todoRefs,
              [e.id]: spawn(todoMachine)
            })
          })
        },
        SET_COMPLETE: {
          actions: sendTo(
            (ctx, e: Extract<TodoEvent, { type: 'SET_COMPLETE' }>) => {
              return ctx.todoRefs[e.id];
            },
            { type: 'SET_COMPLETE' }
          )
        }
      }
    });
    const service = interpret(todosMachine)
      .onDone(() => {
        done();
      })
      .start();

    service.send({ type: 'ADD', id: 42 });
    service.send({ type: 'SET_COMPLETE', id: 42 });
  });

  it('should spawn referenced machines', (done) => {
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
              ref: (_, __, { spawn }) => spawn('child')
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

    interpret(parentMachine)
      .onDone(() => {
        done();
      })
      .start();
  });

  it('should allow bidirectional communication between parent/child actors', (done) => {
    interpret(clientMachine)
      .onDone(() => {
        done();
      })
      .start();
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
            promiseRef: (_, __, { spawn }) => {
              const ref = spawn(
                fromPromise(
                  () =>
                    new Promise((res) => {
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
              guard: (_, e) => e.data === 'response'
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const promiseService = interpret(promiseMachine).onDone(() => {
      done();
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
              promiseRef: (_, __, { spawn }) =>
                spawn('somePromise', { id: 'my-promise' })
            }),
            on: {
              [doneInvoke('my-promise')]: {
                target: 'success',
                guard: (_, e) => e.data === 'response'
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

    const promiseService = interpret(promiseMachine).onDone(() => {
      done();
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
            callbackRef: (_, __, { spawn }) =>
              spawn(
                fromCallback((cb, receive) => {
                  receive((event) => {
                    if (event.type === 'START') {
                      setTimeout(() => {
                        cb({ type: 'SEND_BACK' });
                      }, 10);
                    }
                  });
                })
              )
          }),
          on: {
            START_CB: {
              actions: sendTo((ctx) => ctx.callbackRef!, { type: 'START' })
            },
            SEND_BACK: 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const callbackService = interpret(callbackMachine).onDone(() => {
      done();
    });

    callbackService.start();
    callbackService.send({ type: 'START_CB' });
  });
});

describe('spawning observables', () => {
  it('should spawn an observable', (done) => {
    const observableBehavior = fromObservable(() => interval(10));
    const observableMachine = createMachine({
      id: 'observable',
      initial: 'idle',
      context: {
        observableRef: undefined! as ActorRefFrom<typeof observableBehavior>
      },
      states: {
        idle: {
          entry: assign({
            observableRef: (_, __, { spawn }) => {
              const ref = spawn(observableBehavior, { id: 'int' });

              return ref;
            }
          }),
          on: {
            'xstate.snapshot.int': {
              target: 'success',
              guard: (_, e) => e.data === 5
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const observableService = interpret(observableMachine).onDone(() => {
      done();
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
              observableRef: (_, __, { spawn }) =>
                spawn('interval', { id: 'int' })
            }),
            on: {
              'xstate.snapshot.int': {
                target: 'success',
                guard: (_, e) => e.data === 5
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

    const observableService = interpret(observableMachine).onDone(() => {
      done();
    });

    observableService.start();
  });

  it(`should read the latest snapshot of the event's origin while handling that event`, (done) => {
    const observableBehavior = fromObservable(() => interval(10));
    const observableMachine = createMachine({
      id: 'observable',
      initial: 'idle',
      context: {
        observableRef: undefined! as ActorRefFrom<typeof observableBehavior>
      },
      states: {
        idle: {
          entry: assign({
            observableRef: (_, __, { spawn }) => {
              const ref = spawn(observableBehavior, { id: 'int' });

              return ref;
            }
          }),
          on: {
            'xstate.snapshot.int': {
              target: 'success',
              guard: (ctx: any, e: any) => {
                return e.data === 1 && ctx.observableRef.getSnapshot() === 1;
              }
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const observableService = interpret(observableMachine).onDone(() => {
      done();
    });

    observableService.start();
  });
});

describe('spawning event observables', () => {
  it('should spawn an event observable', (done) => {
    const eventObservableBehavior = fromEventObservable(() =>
      interval(10).pipe(map((val) => ({ type: 'COUNT', val })))
    );
    const observableMachine = createMachine({
      id: 'observable',
      initial: 'idle',
      context: {
        observableRef: undefined! as ActorRefFrom<
          typeof eventObservableBehavior
        >
      },
      states: {
        idle: {
          entry: assign({
            observableRef: (_, __, { spawn }) => {
              const ref = spawn(eventObservableBehavior, { id: 'int' });

              return ref;
            }
          }),
          on: {
            COUNT: {
              target: 'success',
              guard: (_: any, e: any) => e.val === 5
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const observableService = interpret(observableMachine).onDone(() => {
      done();
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
              observableRef: (_, __, { spawn }) =>
                spawn('interval', { id: 'int' })
            }),
            on: {
              COUNT: {
                target: 'success',
                guard: (_: any, e: any) => e.val === 5
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

    const observableService = interpret(observableMachine).onDone(() => {
      done();
    });

    observableService.start();
  });
});

describe('communicating with spawned actors', () => {
  it('should treat an interpreter as an actor', (done) => {
    const existingMachine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: { ACTIVATE: 'active' }
        },
        active: {
          entry: respond({ type: 'EXISTING.DONE' })
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
            // existingRef: () => spawn(existingService)
            existingRef: existingService
          }),
          on: {
            'EXISTING.DONE': 'success'
          },
          after: {
            100: {
              actions: sendTo((ctx) => ctx.existingRef!, { type: 'ACTIVATE' })
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const parentService = interpret(parentMachine).onDone(() => {
      done();
    });

    parentService.start();
  });

  it.skip('should be able to name existing actors', (done) => {
    const existingMachine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: { ACTIVATE: 'active' }
        },
        active: {
          entry: respond({ type: 'EXISTING.DONE' })
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
              actions: sendTo('existing', { type: 'ACTIVATE' })
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const parentService = interpret(parentMachine).onDone(() => {
      done();
    });

    parentService.start();
  });

  it('should be able to communicate with arbitrary actors if sessionId is known', (done) => {
    const existingMachine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: { ACTIVATE: 'active' }
        },
        active: {
          entry: respond({ type: 'EXISTING.DONE' })
        }
      }
    });

    const existingService = interpret(existingMachine).start();

    const parentMachine = createMachine<{ existingRef: ActorRef<any> }>({
      initial: 'pending',
      context: {
        existingRef: existingService
      },
      states: {
        pending: {
          entry: sendTo(existingService, { type: 'ACTIVATE' }),
          on: {
            'EXISTING.DONE': 'success'
          },
          after: {
            100: {
              actions: sendTo((ctx) => ctx.existingRef, { type: 'ACTIVATE' })
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const parentService = interpret(parentMachine).onDone(() => {
      done();
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
            refs: (ctx, _, { spawn }) => {
              count++;
              const c = ctx.items.map((item) =>
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
            promise: (_, __, { spawn }) => {
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
            ref: (_, __, { spawn }) =>
              spawn(fromPromise(() => Promise.resolve(42)))
          })
        }
      }
    });

    const { initialState } = nullActorMachine;

    // expect(initialState.context.ref!.id).toBe('null'); // TODO: identify null actors
    expect(initialState.context.ref!.send).toBeDefined();
  });

  describe('with behaviors', () => {
    it('should work with a transition function behavior', (done) => {
      const countBehavior = fromTransition((count: number, event: any) => {
        if (event.type === 'INC') {
          return count + 1;
        } else if (event.type === 'DEC') {
          return count - 1;
        }
        return count;
      }, 0);

      const countMachine = createMachine<{
        count: ActorRefFrom<typeof countBehavior> | undefined;
      }>({
        context: {
          count: undefined
        },
        entry: assign({
          count: (_, __, { spawn }) => spawn(countBehavior)
        }),
        on: {
          INC: {
            actions: forwardTo((ctx) => ctx.count!)
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

    it('should work with a promise behavior (fulfill)', (done) => {
      const countMachine = createMachine<{
        count: ActorRefFrom<Promise<number>> | undefined;
      }>({
        context: {
          count: undefined
        },
        entry: assign({
          count: (_, __, { spawn }) =>
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
                guard: (_, e) => e.data === 42
              }
            }
          },
          success: {
            type: 'final'
          }
        }
      });

      const countService = interpret(countMachine).onDone(() => {
        done();
      });
      countService.start();
    });

    it('should work with a promise behavior (reject)', (done) => {
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
                guard: (_, e) => {
                  return e.data === errorMessage;
                }
              }
            }
          },
          success: {
            type: 'final'
          }
        }
      });

      const countService = interpret(countMachine).onDone(() => {
        done();
      });
      countService.start();
    });

    it('behaviors should have reference to the parent', (done) => {
      const pongBehavior: ActorBehavior<EventObject, undefined> = {
        transition: (_, event, { self }) => {
          const _event = toSCXMLEvent(event);
          if (_event.name === 'PING') {
            self._parent?.send({ type: 'PONG' });
          }

          return undefined;
        },
        getInitialState: () => undefined
      };

      const pingMachine = createMachine<{
        ponger: ActorRefFrom<typeof pongBehavior> | undefined;
      }>({
        initial: 'waiting',
        context: {
          ponger: undefined
        },
        entry: assign({
          ponger: (_, __, { spawn }) => spawn(pongBehavior)
        }),
        states: {
          waiting: {
            entry: sendTo((ctx) => ctx.ponger!, { type: 'PING' }),
            invoke: {
              id: 'ponger',
              src: pongBehavior
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

      const pingService = interpret(pingMachine).onDone(() => {
        done();
      });
      pingService.start();
    });
  });

  it('should be able to spawn callback actors in (lazy) initial context', (done) => {
    const machine = createMachine<{ ref: ActorRef<any> }>({
      context: ({ spawn }) => ({
        ref: spawn(
          fromCallback((sendBack) => {
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

    interpret(machine)
      .onDone(() => {
        done();
      })
      .start();
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

    interpret(machine)
      .onDone(() => {
        done();
      })
      .start();
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
            child: (_, __, { spawn }) => spawn(childMachine)
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
        child: (_, __, { spawn }) =>
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
        child: (_, __, { spawn }) =>
          spawn(fromObservable(createEmptyObservable))
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
        child: (_, __, { spawn }) =>
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
