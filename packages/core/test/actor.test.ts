import {
  Machine,
  spawn,
  interpret,
  ActorRef,
  ActorRefFrom,
  Behavior,
  createMachine,
  EventObject
} from '../src';
import {
  assign,
  sendParent,
  raise,
  doneInvoke,
  sendUpdate,
  respond,
  forwardTo,
  error,
  sendTo
} from '../src/actions';
import { interval, EMPTY } from 'rxjs';
import { map } from 'rxjs/operators';
import { fromPromise } from '../src/behaviors';

describe('spawning machines', () => {
  const todoMachine = Machine({
    id: 'todo',
    initial: 'incomplete',
    states: {
      incomplete: {
        on: { SET_COMPLETE: 'complete' }
      },
      complete: {
        onEntry: sendParent({ type: 'TODO_COMPLETED' })
      }
    }
  });

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

  const todosMachine = createMachine<typeof context, TodoEvent>({
    id: 'todos',
    context: context,
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
          todoRefs: (ctx, e) => ({
            ...ctx.todoRefs,
            [e.id]: spawn(todoMachine)
          })
        })
      },
      SET_COMPLETE: {
        actions: sendTo((ctx, e) => {
          return ctx.todoRefs[e.id];
        }, 'SET_COMPLETE')
      }
    }
  });

  // Adaptation: https://github.com/p-org/P/wiki/PingPong-program
  type PingPongEvent =
    | { type: 'PING' }
    | { type: 'PONG' }
    | { type: 'SUCCESS' };

  const serverMachine = Machine<any, PingPongEvent>({
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

  const clientMachine = Machine<ClientContext, PingPongEvent>({
    id: 'client',
    initial: 'init',
    context: {
      server: undefined
    },
    states: {
      init: {
        entry: [
          assign({
            server: () => spawn(serverMachine)
          }),
          raise('SUCCESS')
        ],
        on: {
          SUCCESS: 'sendPing'
        }
      },
      sendPing: {
        entry: [
          sendTo((ctx) => ctx.server!, { type: 'PING' }),
          raise('SUCCESS')
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

  it('should invoke actors', (done) => {
    const service = interpret(todosMachine)
      .onDone(() => {
        done();
      })
      .start();

    service.send('ADD', { id: 42 });
    service.send('SET_COMPLETE', { id: 42 });
  });

  it('should invoke actors (when sending batch)', (done) => {
    const service = interpret(todosMachine)
      .onDone(() => {
        done();
      })
      .start();

    service.send([{ type: 'ADD', id: 42 }]);
    service.send('SET_COMPLETE', { id: 42 });
  });

  it('should invoke a null actor if spawned outside of a service', () => {
    expect(spawn(todoMachine)).toBeTruthy();
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
  const promiseMachine = Machine<any>({
    id: 'promise',
    initial: 'idle',
    context: {
      promiseRef: undefined
    },
    states: {
      idle: {
        entry: assign({
          promiseRef: () => {
            const ref = spawn(
              new Promise((res) => {
                res('response');
              }),
              'my-promise'
            );

            return ref;
          }
        }),
        on: {
          [doneInvoke('my-promise')]: {
            target: 'success',
            cond: (_, e) => e.data === 'response'
          }
        }
      },
      success: {
        type: 'final'
      }
    }
  });

  it('should be able to spawn a promise', (done) => {
    const promiseService = interpret(promiseMachine).onDone(() => {
      done();
    });

    promiseService.start();
  });
});

describe('spawning callbacks', () => {
  const callbackMachine = Machine<any>({
    id: 'callback',
    initial: 'idle',
    context: {
      callbackRef: undefined
    },
    states: {
      idle: {
        entry: assign({
          callbackRef: () =>
            spawn((cb, receive) => {
              receive((event) => {
                if (event.type === 'START') {
                  setTimeout(() => {
                    cb('SEND_BACK');
                  }, 10);
                }
              });
            })
        }),
        on: {
          START_CB: {
            actions: sendTo((ctx) => ctx.callbackRef, { type: 'START' })
          },
          SEND_BACK: 'success'
        }
      },
      success: {
        type: 'final'
      }
    }
  });

  it('should be able to spawn an actor from a callback', (done) => {
    const callbackService = interpret(callbackMachine).onDone(() => {
      done();
    });

    callbackService.start();
    callbackService.send('START_CB');
  });
});

describe('spawning observables', () => {
  interface Events {
    type: 'INT';
    value: number;
  }

  const observableMachine = Machine<any, Events>({
    id: 'observable',
    initial: 'idle',
    context: {
      observableRef: undefined
    },
    states: {
      idle: {
        entry: assign({
          observableRef: () => {
            const ref = spawn(
              interval(10).pipe(
                map((n) => ({
                  type: 'INT',
                  value: n
                }))
              )
            );

            return ref;
          }
        }),
        on: {
          INT: {
            target: 'success',
            cond: (_, e) => e.value === 5
          }
        }
      },
      success: {
        type: 'final'
      }
    }
  });

  it('should be able to spawn an observable', (done) => {
    const observableService = interpret(observableMachine).onDone(() => {
      done();
    });

    observableService.start();
  });
});

describe('communicating with spawned actors', () => {
  it('should treat an interpreter as an actor', (done) => {
    const existingMachine = Machine({
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

    const parentMachine = Machine<any>({
      initial: 'pending',
      context: {
        existingRef: undefined as any
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

  it('should be able to name existing actors', (done) => {
    const existingMachine = Machine({
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
      existingRef: ActorRef<any> | undefined;
    }>({
      initial: 'pending',
      context: {
        existingRef: undefined
      },
      states: {
        pending: {
          entry: assign({
            existingRef: () => spawn(existingService, 'existing')
          }),
          on: {
            'EXISTING.DONE': 'success'
          },
          after: {
            100: {
              actions: sendTo('existing', 'ACTIVATE')
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
    const existingMachine = Machine({
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

    const parentMachine = createMachine<any>({
      initial: 'pending',
      states: {
        pending: {
          entry: sendTo(existingService.sessionId, { type: 'ACTIVATE' }),
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

    const startMachine = Machine<any>({
      id: 'start',
      initial: 'start',
      context: {
        items: [0, 1, 2, 3],
        refs: []
      },
      states: {
        start: {
          entry: assign({
            refs: (ctx) => {
              count++;
              const c = ctx.items.map((item: any) =>
                spawn(new Promise((res) => res(item)))
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

    const child = Machine<TestContext>({
      initial: 'bar',
      context: {},
      states: {
        bar: {
          entry: assign<TestContext>({
            promise: () => {
              return spawn(() => {
                spawnCounter++;
                return Promise.resolve('answer');
              });
            }
          })
        }
      }
    });

    const parent = Machine({
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

    const testMachine = createMachine<{ ref: ActorRef<any> }>({
      initial: 'testing',
      context: () => {
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
    expect(service.state.value).toEqual('done');
  });

  it('should spawn null actors if not used within a service', () => {
    interface TestContext {
      ref?: ActorRef<any>;
    }

    const nullActorMachine = Machine<TestContext>({
      initial: 'foo',
      context: { ref: undefined },
      states: {
        foo: {
          entry: assign<TestContext>({
            ref: () => spawn(Promise.resolve(42))
          })
        }
      }
    });

    const { initialState } = nullActorMachine;

    // expect(initialState.context.ref!.id).toBe('null'); // TODO: identify null actors
    expect(initialState.context.ref!.send).toBeDefined();
  });

  describe('autoForward option', () => {
    const pongActorMachine = Machine({
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

      const machine = Machine<any>({
        id: 'client',
        context: { counter: 0, serverRef: undefined },
        initial: 'initial',
        states: {
          initial: {
            entry: assign(() => ({
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

      const machine = Machine<{ counter: number; serverRef?: ActorRef<any> }>({
        id: 'client',
        context: { counter: 0, serverRef: undefined },
        initial: 'initial',
        states: {
          initial: {
            entry: assign((ctx) => ({
              ...ctx,
              serverRef: spawn(pongActorMachine, { autoForward: false })
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

    it('should forward events to a spawned actor when { autoForward: true }', () => {
      let pongCounter = 0;

      const machine = Machine<any>({
        id: 'client',
        context: { counter: 0, serverRef: undefined },
        initial: 'initial',
        states: {
          initial: {
            entry: assign(() => ({
              serverRef: spawn(pongActorMachine, { autoForward: true })
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
      expect(pongCounter).toEqual(2);
    });
  });

  describe('sync option', () => {
    const childMachine = Machine({
      id: 'child',
      context: { value: 0 },
      initial: 'active',
      states: {
        active: {
          after: {
            10: { actions: assign({ value: 42 }), internal: true }
          }
        }
      }
    });

    interface TestContext {
      ref?: ActorRefFrom<typeof childMachine>;
      refNoSync?: ActorRefFrom<typeof childMachine>;
      refNoSyncDefault?: ActorRefFrom<typeof childMachine>;
    }

    const parentMachine = Machine<TestContext>({
      id: 'parent',
      context: {
        ref: undefined,
        refNoSync: undefined,
        refNoSyncDefault: undefined
      },
      initial: 'foo',
      states: {
        foo: {
          entry: assign<TestContext>({
            ref: () => spawn(childMachine, { sync: true }),
            refNoSync: () => spawn(childMachine, { sync: false }),
            refNoSyncDefault: () => spawn(childMachine)
          })
        },
        success: {
          type: 'final'
        }
      }
    });

    it('should sync spawned actor state when { sync: true }', () => {
      return new Promise<void>((res) => {
        const service = interpret(parentMachine, {
          id: 'a-service'
        }).onTransition((s) => {
          if (s.context.ref?.getSnapshot()?.context.value === 42) {
            res();
          }
        });
        service.start();
      });
    });

    it('should not sync spawned actor state when { sync: false }', () => {
      return new Promise<void>((res, rej) => {
        const service = interpret(parentMachine, {
          id: 'b-service'
        }).onTransition((s) => {
          if (s.context.refNoSync?.getSnapshot()?.context.value === 42) {
            rej(new Error('value change caused transition'));
          }
        });
        service.start();

        setTimeout(() => {
          expect(
            service.state.context.refNoSync?.getSnapshot()?.context.value
          ).toBe(42);
          res();
        }, 30);
      });
    });

    it('should not sync spawned actor state (default)', () => {
      return new Promise<void>((res, rej) => {
        const service = interpret(parentMachine, {
          id: 'c-service'
        }).onTransition((s) => {
          if (s.context.refNoSyncDefault?.getSnapshot()?.context.value === 42) {
            rej(new Error('value change caused transition'));
          }
        });
        service.start();

        setTimeout(() => {
          expect(
            service.state.context.refNoSyncDefault?.getSnapshot()?.context.value
          ).toBe(42);
          res();
        }, 30);
      });
    });

    it('parent state should be changed if synced child actor update occurs', (done) => {
      const syncChildMachine = Machine({
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

      const syncMachine = Machine<SyncMachineContext>({
        initial: 'same',
        context: {},
        states: {
          same: {
            entry: assign<SyncMachineContext>({
              ref: () => spawn(syncChildMachine, { sync: true })
            })
          }
        }
      });

      interpret(syncMachine)
        .onTransition((state) => {
          if (state.context.ref?.getSnapshot()?.matches('inactive')) {
            expect(state.changed).toBe(true);
            done();
          }
        })
        .start();
    });

    const falseSyncOptions = [{}, { sync: false }];

    falseSyncOptions.forEach((falseSyncOption) => {
      it(`parent state should NOT be changed regardless of unsynced child actor update (options: ${JSON.stringify(
        falseSyncOption
      )})`, (done) => {
        const syncChildMachine = Machine({
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

        const syncMachine = Machine<SyncMachineContext>({
          initial: 'same',
          context: {},
          states: {
            same: {
              entry: assign<SyncMachineContext>({
                ref: () => spawn(syncChildMachine, falseSyncOption)
              })
            }
          }
        });

        const service = interpret(syncMachine)
          .onTransition((state) => {
            if (
              state.context.ref &&
              state.context.ref.getSnapshot()?.matches('inactive')
            ) {
              expect(state.changed).toBe(false);
            }
          })
          .start();

        setTimeout(() => {
          expect(
            service.state.context.ref?.getSnapshot()?.matches('inactive')
          ).toBe(true);
          done();
        }, 20);
      });

      it(`parent state should be changed if unsynced child actor manually sends update event (options: ${JSON.stringify(
        falseSyncOption
      )})`, (done) => {
        const syncChildMachine = Machine({
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

        const syncMachine = Machine<SyncMachineContext>({
          initial: 'same',
          context: {},
          states: {
            same: {
              entry: assign<SyncMachineContext>({
                ref: () => spawn(syncChildMachine, falseSyncOption)
              })
            }
          }
        });

        interpret(syncMachine)
          .onTransition((state) => {
            if (state.context.ref?.getSnapshot()?.matches('inactive')) {
              expect(state.changed).toBe(true);
              done();
            }
          })
          .start();
      });
    });
  });

  describe('with behaviors', () => {
    it('should work with a reducer behavior', (done) => {
      const countBehavior: Behavior<EventObject, number> = {
        transition: (count, event) => {
          if (event.type === 'INC') {
            return count + 1;
          } else {
            return count - 1;
          }
        },
        initialState: 0
      };

      const countMachine = createMachine<{
        count: ActorRefFrom<typeof countBehavior> | undefined;
      }>({
        context: {
          count: undefined
        },
        entry: assign({
          count: () => spawn(countBehavior)
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
      const promiseBehavior = fromPromise(
        () =>
          new Promise<number>((res) => {
            setTimeout(() => res(42));
          })
      );

      const countMachine = createMachine<{
        count: ActorRefFrom<typeof promiseBehavior> | undefined;
      }>({
        context: {
          count: undefined
        },
        entry: assign({
          count: () => spawn(promiseBehavior, 'test')
        }),
        initial: 'pending',
        states: {
          pending: {
            on: {
              'done.invoke.test': {
                target: 'success',
                cond: (_, e) => e.data === 42
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
      const promiseBehavior = fromPromise(
        () =>
          new Promise<number>((_, rej) => {
            setTimeout(() => rej(errorMessage), 1000);
          })
      );

      const countMachine = createMachine<{
        count: ActorRefFrom<typeof promiseBehavior>;
      }>({
        context: () => ({
          count: spawn(promiseBehavior, 'test')
        }),
        initial: 'pending',
        states: {
          pending: {
            on: {
              [error('test')]: {
                target: 'success',
                cond: (_, e) => {
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
        transition: (_, event, { parent }) => {
          if (event.type === 'PING') {
            parent?.send({ type: 'PONG' });
          }

          return undefined;
        },
        initialState: undefined
      };

      const pingMachine = createMachine<{
        ponger: ActorRefFrom<typeof pongBehavior> | undefined;
      }>({
        initial: 'waiting',
        context: {
          ponger: undefined
        },
        entry: assign({
          ponger: () => spawn(pongBehavior)
        }),
        states: {
          waiting: {
            entry: sendTo((ctx) => ctx.ponger!, { type: 'PING' }),
            invoke: {
              id: 'ponger',
              src: () => pongBehavior
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
      context: () => ({
        ref: spawn((sendBack) => {
          sendBack('TEST');
        })
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

    const machine = createMachine<{ ref: ActorRef<any> }>({
      context: () => ({
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
            child: (_) => spawn(childMachine)
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
        child: () => spawn({ then: (fn: any) => fn(null) } as any)
      })
    });
    const service = interpret(parentMachine);
    expect(() => {
      service.start();
    }).not.toThrow();
  });

  it('should not crash on child observable sync completion during self-initialization', () => {
    const createEmptyObservable = (): any => ({
      subscribe(_next: () => void, _error: () => void, complete: () => void) {
        complete();
      }
    });
    const parentMachine = createMachine<{
      child: ActorRef<never, any> | null;
    }>({
      context: {
        child: null
      },
      entry: assign({
        child: () => spawn(createEmptyObservable())
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
        child: () => spawn(EMPTY, 'myactor')
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

    expect(service.state.value).toBe('done');
  });
});
