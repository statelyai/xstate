import {
  interpret,
  createMachine2 as createMachine,
  ActorRef,
  ActorRefFrom,
  EventObject,
  Behavior,
  Subscribable,
  Observer,
  toSCXMLEvent,
  AnyActorRef
} from '../src';
import { sendParent, sendUpdate, respond, forwardTo } from '../src/actions';
import { raise } from '../src/actions/raise';
import { assign } from '../src/actions/assign';
import { send } from '../src/actions/send';
import { EMPTY, interval } from 'rxjs';
import * as actionTypes from '../src/actionTypes';
import {
  fromCallback,
  fromObservable,
  fromEventObservable,
  fromPromise,
  fromReducer
} from '../src/actors';
import { map } from 'rxjs/operators';

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

  const serverMachine = createMachine<{ events: PingPongEvent }>({
    id: 'server',
    initial: 'waitPing',
    states: {
      waitPing: {
        on: {
          PING: 'sendPong'
        }
      },
      sendPong: {
        entry: [sendParent('PONG'), raise('SUCCESS')],
        on: {
          SUCCESS: 'waitPing'
        }
      }
    }
  });

  interface ClientContext {
    server?: ActorRef<PingPongEvent>;
  }

  const clientMachine = createMachine<{
    context: ClientContext;
    events: PingPongEvent;
  }>({
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
          raise('SUCCESS')
        ],
        on: {
          SUCCESS: 'sendPing'
        }
      },
      sendPing: {
        entry: [send('PING', { to: (ctx) => ctx.server! }), raise('SUCCESS')],
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

    const todosMachine = createMachine<{
      context: typeof context;
      events: TodoEvent;
    }>({
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
          actions: send('SET_COMPLETE', {
            to: (ctx, e: Extract<TodoEvent, { type: 'SET_COMPLETE' }>) => {
              return ctx.todoRefs[e.id];
            }
          })
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
      entry: sendParent('DONE')
    });

    const parentMachine = createMachine<{
      context: { ref: AnyActorRef | null };
    }>(
      {
        context: {
          ref: null
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
          child: () => childMachine
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
    const promiseMachine = createMachine<{
      context: { promiseRef?: AnyActorRef };
      children: {
        'my-promise': { data: string };
      };
    }>({
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
                'my-promise'
              );

              return ref;
            }
          }),
          on: {
            'done.invoke.my-promise': {
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
    const promiseMachine = createMachine<{
      context: { promiseRef?: AnyActorRef };
      children: {
        'my-promise': { data: string };
      };
    }>(
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
                spawn('somePromise', 'my-promise')
            }),
            on: {
              'done.invoke.my-promise': {
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
          somePromise: () =>
            fromPromise(
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
    const callbackMachine = createMachine<{
      context: { callbackRef?: AnyActorRef };
    }>({
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
              actions: send('START', { to: (ctx) => ctx.callbackRef })
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
    callbackService.send('START_CB');
  });
});

describe('spawning observables', () => {
  it('should spawn an observable', (done) => {
    const observableMachine = createMachine<{
      context: { observableRef?: ActorRef<any, number | undefined> };
      children: {
        int: {
          snapshot: number;
        };
      };
    }>({
      id: 'observable',
      initial: 'idle',
      context: {
        observableRef: undefined
      },
      states: {
        idle: {
          entry: assign({
            observableRef: (_, __, { spawn }) => {
              const ref = spawn(
                fromObservable(() => interval(10)),
                'int'
              );

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
    const observableMachine = createMachine<{
      context: { observableRef?: ActorRef<any, number | undefined> };
      children: {
        int: {
          snapshot: number;
        };
      };
    }>(
      {
        id: 'observable',
        initial: 'idle',
        context: {
          observableRef: undefined
        },
        states: {
          idle: {
            entry: assign({
              observableRef: (_, __, { spawn }) => spawn('interval', 'int')
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
          interval: () => fromObservable(() => interval(10))
        }
      }
    );

    const observableService = interpret(observableMachine).onDone(() => {
      done();
    });

    observableService.start();
  });
});

describe('spawning event observables', () => {
  it('should spawn an event observable', (done) => {
    const observableMachine = createMachine<{
      context: {
        observableRef?: ActorRef<
          any,
          { type: 'COUNT'; val: number } | undefined
        >;
      };
      events: { type: 'COUNT'; val: number };
    }>({
      id: 'observable',
      initial: 'idle',
      context: {
        observableRef: undefined
      },
      states: {
        idle: {
          entry: assign({
            observableRef: (_, __, { spawn }) => {
              const ref = spawn(
                fromEventObservable(() =>
                  interval(10).pipe(
                    map((val) => ({ type: 'COUNT' as const, val }))
                  )
                ),
                'int'
              );

              return ref;
            }
          }),
          on: {
            COUNT: {
              target: 'success',
              guard: (_, e) => e.val === 5
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
    const observableMachine = createMachine<{
      context: {
        observableRef?: ActorRef<
          any,
          { type: 'COUNT'; val: number } | undefined
        >;
      };
      events: { type: 'COUNT'; val: number };
    }>(
      {
        id: 'observable',
        initial: 'idle',
        context: {
          observableRef: undefined
        },
        states: {
          idle: {
            entry: assign({
              observableRef: (_, __, { spawn }) => spawn('interval', 'int')
            }),
            on: {
              COUNT: {
                target: 'success',
                guard: (_, e) => e.val === 5
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
          interval: () =>
            fromEventObservable(() =>
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
          entry: respond('EXISTING.DONE')
        }
      }
    });

    const existingService = interpret(existingMachine).start();

    const parentMachine = createMachine<{
      context: { existingRef?: AnyActorRef };
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
            existingRef: existingService.ref
          }),
          on: {
            'EXISTING.DONE': 'success'
          },
          after: {
            100: {
              actions: send('ACTIVATE', { to: (ctx) => ctx.existingRef })
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
          entry: respond('EXISTING.DONE')
        }
      }
    });

    const existingService = interpret(existingMachine).start();

    const parentMachine = createMachine<{
      context: { existingRef: AnyActorRef | undefined };
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
              actions: send('ACTIVATE', { to: 'existing' })
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
          entry: respond('EXISTING.DONE')
        }
      }
    });

    const existingService = interpret(existingMachine).start();

    const parentMachine = createMachine<{
      context: { existingRef: AnyActorRef };
    }>({
      initial: 'pending',
      context: {
        existingRef: existingService
      },
      states: {
        pending: {
          entry: send('ACTIVATE', { to: () => existingService }),
          on: {
            'EXISTING.DONE': 'success'
          },
          after: {
            100: {
              actions: send('ACTIVATE', { to: (ctx) => ctx.existingRef })
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
      context: {
        items: number[];
        refs: ActorRef<never, number | undefined>[];
      };
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
                spawn(
                  fromPromise(
                    () => new Promise<number>((res) => res(item))
                  )
                )
              );

              return c;
            }
          })
        }
      }
    });

    interpret(startMachine)
      .onTransition(() => {
        expect(count).toEqual(1);
      })
      .start();
  });

  it('should only spawn an actor in an initial state of a child that gets invoked in the initial state of a parent when the parent gets started', () => {
    let spawnCounter = 0;

    interface TestContext {
      promise?: ActorRefFrom<Promise<string>>;
    }

    const child = createMachine<{ context: TestContext }>({
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
          entry: sendParent('ping')
        }
      }
    });

    const testMachine = createMachine<{ context: { ref: AnyActorRef } }>({
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
    const nullActorMachine = createMachine<{
      context: { ref?: AnyActorRef };
    }>({
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

  describe('autoForward option', () => {
    const pongActorMachine = createMachine({
      id: 'server',
      initial: 'waitPing',
      states: {
        waitPing: {
          on: {
            PING: 'sendPong'
          }
        },
        sendPong: {
          entry: [sendParent('PONG'), raise('SUCCESS')],
          on: {
            SUCCESS: 'waitPing'
          }
        }
      }
    });

    it('should not forward events to a spawned actor by default', () => {
      let pongCounter = 0;

      const machine = createMachine<{}>({
        id: 'client',
        context: { counter: 0, serverRef: undefined },
        initial: 'initial',
        states: {
          initial: {
            entry: assign((_, __, { spawn }) => ({
              serverRef: spawn(pongActorMachine)
            })),
            on: {
              PONG: {
                actions: () => ++pongCounter
              }
            }
          }
        }
      });
      const service = interpret(machine);
      service.start();
      service.send('PING');
      service.send('PING');
      expect(pongCounter).toEqual(0);
    });

    it('should not forward events to a spawned actor when { autoForward: false }', () => {
      let pongCounter = 0;

      const machine = createMachine<{
        context: {
          counter: number;
          serverRef?: AnyActorRef;
        };
      }>({
        id: 'client',
        context: { counter: 0, serverRef: undefined },
        initial: 'initial',
        states: {
          initial: {
            entry: assign((ctx, _, { spawn }) => ({
              ...ctx,
              serverRef: spawn(
                pongActorMachine
                // {
                //   autoForward: false
                // }
              )
            })),
            on: {
              PONG: {
                actions: () => ++pongCounter
              }
            }
          }
        }
      });
      const service = interpret(machine);
      service.start();
      service.send('PING');
      service.send('PING');
      expect(pongCounter).toEqual(0);
    });
  });

  describe.skip('sync option', () => {
    const childMachine = createMachine({
      id: 'child',
      context: { value: 0 },
      initial: 'active',
      states: {
        active: {
          after: {
            10: { actions: assign({ value: 42 }) }
          }
        }
      }
    });

    it('should sync spawned actor state when { sync: true }', (done) => {
      const machine = createMachine<{
        context: { ref?: AnyActorRef };
      }>({
        id: 'parent',
        context: {
          ref: undefined
        },
        initial: 'foo',
        states: {
          foo: {
            entry: assign({
              ref: (_, __, { spawn }) =>
                spawn(
                  childMachine
                  // { sync: true }
                )
            }),
            on: {
              [actionTypes.update]: 'success'
            }
          },
          success: {
            type: 'final'
          }
        }
      });

      const service = interpret(machine, {
        id: 'a-service'
      }).onDone(() => {
        done();
      });
      service.start();
    });

    it('should not sync spawned actor state when { sync: false }', (done) => {
      const machine = createMachine<{
        context: { refNoSync?: AnyActorRef };
      }>({
        id: 'parent',
        context: {
          refNoSync: undefined
        },
        initial: 'foo',
        states: {
          foo: {
            entry: assign({
              refNoSync: (_, __, { spawn }) =>
                spawn(
                  childMachine
                  // { sync: false }
                )
            }),
            on: {
              '*': 'failure'
            }
          },
          failure: {
            type: 'final'
          }
        }
      });

      const service = interpret(machine, {
        id: 'b-service'
      }).onDone(() => {
        throw new Error('value change caused transition');
      });
      service.start();

      setTimeout(() => {
        done();
      }, 30);
    });

    it('should not sync spawned actor state (default)', (done) => {
      const machine = createMachine<{
        context: { refNoSyncDefault?: AnyActorRef };
      }>({
        id: 'parent',
        context: {
          refNoSyncDefault: undefined
        },
        initial: 'foo',
        states: {
          foo: {
            entry: assign({
              refNoSyncDefault: (_, __, { spawn }) => spawn(childMachine)
            }),
            on: {
              '*': 'failure'
            }
          },
          failure: {
            type: 'final'
          }
        }
      });

      const service = interpret(machine, {
        id: 'b-service'
      }).onDone(() => {
        throw new Error('value change caused transition');
      });
      service.start();

      setTimeout(() => {
        done();
      }, 30);
    });

    it('parent state should be changed if synced child actor update occurs', (done) => {
      const syncChildMachine = createMachine({
        initial: 'active',
        states: {
          active: {
            after: { 500: 'inactive' }
          },
          inactive: {}
        }
      });

      interface SyncMachineContext {
        ref?: ActorRefFrom<typeof syncChildMachine>;
      }

      const syncMachine = createMachine<{ context: SyncMachineContext }>({
        initial: 'same',
        context: {},
        states: {
          same: {
            entry: assign({
              ref: (_, __, { spawn }) => {
                return spawn(
                  syncChildMachine
                  // { sync: true }
                );
              }
            }),
            on: {
              [actionTypes.update]: 'success'
            }
          },
          success: {
            type: 'final'
          }
        }
      });

      interpret(syncMachine)
        .onDone(() => {
          done();
        })
        .start();
    });

    const falseSyncOptions = [{}, { sync: false }];

    falseSyncOptions.forEach((falseSyncOption) => {
      it(`parent state should NOT be changed regardless of unsynced child actor update (options: ${JSON.stringify(
        falseSyncOption
      )})`, (done) => {
        const syncChildMachine = createMachine({
          initial: 'active',
          states: {
            active: {
              after: { 10: 'inactive' }
            },
            inactive: {}
          }
        });

        interface SyncMachineContext {
          ref?: ActorRefFrom<typeof syncChildMachine>;
        }

        const syncMachine = createMachine<{ context: SyncMachineContext }>({
          initial: 'same',
          context: {},
          states: {
            same: {
              entry: assign({
                ref: (_, __, { spawn }) =>
                  spawn(syncChildMachine /* falseSyncOption */)
              }),
              on: {
                '*': 'failure'
              }
            },
            failure: {}
          }
        });

        interpret(syncMachine)
          .onDone(() => {
            done();
          })
          .onTransition((state) => {
            expect(state.matches('failure')).toBeFalsy();
          })
          .start();

        setTimeout(() => {
          done();
        }, 20);
      });

      it(`parent state should be changed if unsynced child actor manually sends update event (options: ${JSON.stringify(
        falseSyncOption
      )})`, (done) => {
        const syncChildMachine = createMachine({
          initial: 'active',
          states: {
            active: {
              after: { 10: 'inactive' }
            },
            inactive: {
              entry: sendUpdate()
            }
          }
        });

        interface SyncMachineContext {
          ref?: ActorRefFrom<typeof syncChildMachine>;
        }

        const syncMachine = createMachine<{ context: SyncMachineContext }>({
          initial: 'same',
          context: {},
          states: {
            same: {
              entry: assign({
                ref: (_, __, { spawn }) =>
                  spawn(syncChildMachine /* falseSyncOption */)
              })
            }
          }
        });

        interpret(syncMachine)
          .onTransition((state) => {
            if (state.event.type === actionTypes.update) {
              expect(state.changed).toBe(true);
              done();
            }
          })
          .start();
      });

      it('should only spawn an actor in an initial state of a child that gets invoked in the initial state of a parent when the parent gets started', (done) => {
        let spawnCounter = 0;

        const child = createMachine<{
          context: {
            promise?: ActorRefFrom<Promise<string>>;
          };
        }>({
          initial: 'bar',
          context: {},
          states: {
            bar: {
              entry: assign({
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

        interpret(parent)
          .onTransition(() => {
            if (spawnCounter === 1) {
              done();
            }
          })
          .start();
      });
    });
  });

  describe('with behaviors', () => {
    it('should work with a reducer behavior', (done) => {
      const countBehavior = fromReducer((count: number, event: any) => {
        if (event.type === 'INC') {
          return count + 1;
        } else if (event.type === 'DEC') {
          return count - 1;
        }
        return count;
      }, 0);

      const countMachine = createMachine<{
        context: { count: ActorRefFrom<typeof countBehavior> | undefined };
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

      const countService = interpret(countMachine)
        .onTransition((state) => {
          if (state.context.count?.getSnapshot() === 2) {
            done();
          }
        })
        .start();

      countService.send('INC');
      countService.send('INC');
    });

    it('should work with a promise behavior (fulfill)', (done) => {
      const countMachine = createMachine<{
        context: { count: ActorRefFrom<Promise<number>> | undefined };
        children: {
          test: { data: number };
        };
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
              'test'
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
        context: { count: ActorRefFrom<Promise<number>> };
        children: {
          test: { data: any };
        };
      }>({
        context: ({ spawn }) => ({
          count: spawn(
            fromPromise(
              () =>
                new Promise<number>((_, rej) => {
                  setTimeout(() => rej(errorMessage), 1000);
                })
            ),
            'test'
          )
        }),
        initial: 'pending',
        states: {
          pending: {
            on: {
              // TODO: this should be error.invoke.test?
              'error.platform.test': {
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
      const pongBehavior: Behavior<EventObject, undefined> = {
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
        context: { ponger: ActorRefFrom<typeof pongBehavior> | undefined };
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
            entry: send('PING', { to: (ctx) => ctx.ponger! }),
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
    const machine = createMachine<{ context: { ref: AnyActorRef } }>({
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
      entry: sendParent('TEST')
    });

    const machine = createMachine<{ context: { ref: AnyActorRef } }>({
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
      context: { child: ActorRefFrom<typeof childMachine> | null };
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
      context: { child: AnyActorRef | null };
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
      context: { child: AnyActorRef | null };
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
      context: { child: ActorRef<EventObject, unknown> | null };
    }>({
      context: {
        child: null
      },
      entry: assign({
        child: (_, __, { spawn }) =>
          spawn(
            fromObservable(() => EMPTY),
            'myactor'
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
});
