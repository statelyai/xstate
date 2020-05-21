import { Machine, interpret, createMachine, ActorRef } from '../src';
import {
  assign,
  send,
  sendParent,
  raise,
  doneInvoke,
  sendUpdate,
  respond
} from '../src/actions';
import { fromService } from '../src/Actor';
import { interval } from 'rxjs';
import { map } from 'rxjs/operators';
import * as actionTypes from '../src/actionTypes';
import { createMachineBehavior } from '../src/behavior';

describe('spawning machines', () => {
  const todoMachine = Machine({
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

  const todosMachine = Machine<any, TodoEvent>({
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
            [e.id]: spawn.from(todoMachine)
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

  // Adaptation: https://github.com/p-org/P/wiki/PingPong-program
  type PingPongEvent =
    | { type: 'PING' }
    | { type: 'PONG' }
    | { type: 'SUCCESS' };

  const serverMachine = Machine({
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
    server?: ActorRef<any>;
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
            server: (_, __, { spawn }) => spawn.from(serverMachine)
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

  it('should invoke actors', (done) => {
    const service = interpret(todosMachine)
      .onDone(() => {
        done();
      })
      .start();

    service.send({ type: 'ADD', id: 42 });
    service.send({ type: 'SET_COMPLETE', id: 42 });
  });

  it('should invoke actors (when sending batch)', (done) => {
    const service = interpret(todosMachine)
      .onDone(() => {
        done();
      })
      .start();

    service.send([{ type: 'ADD', id: 42 }]);
    service.send({ type: 'SET_COMPLETE', id: 42 });
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
          promiseRef: (_, __, { spawn }) => {
            const promise = new Promise((res) => {
              res('response');
            });

            const ref = spawn.from(promise, 'my-promise');

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
              spawn.from((cb, receive) => {
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
  it('should be able to spawn an observable', (done) => {
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
            observableRef: (_, __, { spawn }) => {
              const ref = spawn.from(
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

    const parentMachine = Machine<{
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

    const parentMachine = Machine<{ existingRef: ActorRef<any> }>({
      initial: 'pending',
      context: {
        existingRef: fromService(existingService)
      },
      states: {
        pending: {
          entry: send('ACTIVATE', { to: existingService.sessionId }),
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
            refs: (ctx, _, { spawn }) => {
              count++;
              const c = ctx.items.map((item) =>
                spawn.from(new Promise((res) => res(item)))
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

  it('should spawn null actors if not used within a service', () => {
    const nullActorMachine = Machine<{ ref?: ActorRef<any> }>({
      initial: 'foo',
      context: { ref: undefined },
      states: {
        foo: {
          entry: assign({
            ref: (_, __, { spawn }) => spawn.from(Promise.resolve(42))
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
            entry: assign((_, __, { spawn }) => ({
              serverRef: spawn.from(pongActorMachine)
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

      const machine = Machine<{
        counter: number;
        serverRef?: ActorRef<any>;
      }>({
        id: 'client',
        context: { counter: 0, serverRef: undefined },
        initial: 'initial',
        states: {
          initial: {
            entry: assign((ctx, _, { self, spawn }) => ({
              ...ctx,
              serverRef: spawn(
                createMachineBehavior(pongActorMachine, self, {
                  autoForward: false
                })
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

    it('should sync spawned actor state when { sync: true }', (done) => {
      const machine = Machine<{
        ref?: ActorRef<any>;
      }>({
        id: 'parent',
        context: {
          ref: undefined
        },
        initial: 'foo',
        states: {
          foo: {
            entry: assign({
              ref: (_, __, { self, spawn }) =>
                spawn(createMachineBehavior(childMachine, self, { sync: true }))
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
      const machine = Machine<{
        refNoSync?: ActorRef<any>;
      }>({
        id: 'parent',
        context: {
          refNoSync: undefined
        },
        initial: 'foo',
        states: {
          foo: {
            entry: assign({
              refNoSync: (_, __, { self, spawn }) =>
                spawn(
                  createMachineBehavior(childMachine, self, { sync: false })
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
      const machine = Machine<{
        refNoSyncDefault?: ActorRef<any>;
      }>({
        id: 'parent',
        context: {
          refNoSyncDefault: undefined
        },
        initial: 'foo',
        states: {
          foo: {
            entry: assign({
              refNoSyncDefault: (_, __, { self, spawn }) =>
                spawn(createMachineBehavior(childMachine, self))
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
        ref?: ActorRef<any>;
      }

      const syncMachine = Machine<SyncMachineContext>({
        initial: 'same',
        context: {},
        states: {
          same: {
            entry: assign<SyncMachineContext>({
              ref: (_, __, { self, spawn }) => {
                return spawn(
                  createMachineBehavior(syncChildMachine, self, { sync: true })
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
          ref?: ActorRef<any>;
        }

        const syncMachine = Machine<SyncMachineContext>({
          initial: 'same',
          context: {},
          states: {
            same: {
              entry: assign({
                ref: (_, __, { self, spawn }) =>
                  spawn(
                    createMachineBehavior(
                      syncChildMachine,
                      self,
                      falseSyncOption
                    )
                  )
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
          ref?: ActorRef<any>;
        }

        const syncMachine = Machine<SyncMachineContext>({
          initial: 'same',
          context: {},
          states: {
            same: {
              entry: assign({
                ref: (_, __, { self, spawn }) =>
                  spawn(
                    createMachineBehavior(
                      syncChildMachine,
                      self,
                      falseSyncOption
                    )
                  )
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
    });
  });
});
