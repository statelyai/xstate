import {
  interpret,
  assign,
  sendParent,
  send,
  EventObject,
  StateValue,
  createMachine,
  ActorContext,
  ActorBehavior,
  SpecialTargets,
  toSCXMLEvent
} from '../src/index.js';
import { fromTransition } from '../src/actors/index.js';
import { fromObservable, fromEventObservable } from '../src/actors/index.js';
import { fromPromise } from '../src/actors/index.js';
import { fromCallback } from '../src/actors/index.js';
import {
  actionTypes,
  done as _done,
  doneInvoke,
  escalate,
  forwardTo,
  sendTo,
  raise
} from '../src/actions.js';
import { interval } from 'rxjs';
import { map, take } from 'rxjs/operators';

const user = { name: 'David' };

const fetchMachine = createMachine<{ userId: string | undefined }>({
  id: 'fetch',
  context: ({ input }) => ({
    userId: input.userId
  }),
  initial: 'pending',
  states: {
    pending: {
      entry: send({ type: 'RESOLVE', user }),
      on: {
        RESOLVE: {
          target: 'success',
          guard: (ctx) => ctx.userId !== undefined
        }
      }
    },
    success: {
      type: 'final',
      data: { user: (_: any, e: any) => e.user }
    },
    failure: {
      entry: sendParent({ type: 'REJECT' })
    }
  }
});

const fetcherMachine = createMachine({
  id: 'fetcher',
  initial: 'idle',
  context: {
    selectedUserId: '42',
    user: undefined
  },
  states: {
    idle: {
      on: {
        GO_TO_WAITING: 'waiting',
        GO_TO_WAITING_MACHINE: 'waitingInvokeMachine'
      }
    },
    waiting: {
      invoke: {
        src: fetchMachine,
        input: {
          userId: (ctx: any) => ctx.selectedUserId
        },
        onDone: {
          target: 'received',
          guard: (_, e) => {
            // Should receive { user: { name: 'David' } } as event data
            return e.data.user.name === 'David';
          }
        }
      }
    },
    waitingInvokeMachine: {
      invoke: {
        src: fetchMachine,
        input: { userId: '55' },
        onDone: 'received'
      }
    },
    received: {
      type: 'final'
    }
  }
});

describe('invoke', () => {
  it('child can immediately respond to the parent with multiple events', () => {
    const childMachine = createMachine({
      id: 'child',
      initial: 'init',
      states: {
        init: {
          on: {
            FORWARD_DEC: {
              actions: [
                sendParent({ type: 'DEC' }),
                sendParent({ type: 'DEC' }),
                sendParent({ type: 'DEC' })
              ]
            }
          }
        }
      }
    });

    const someParentMachine = createMachine<{ count: number }>(
      {
        id: 'parent',
        context: { count: 0 },
        initial: 'start',
        states: {
          start: {
            invoke: {
              src: 'child',
              id: 'someService'
            },
            always: {
              target: 'stop',
              guard: (ctx) => ctx.count === -3
            },
            on: {
              DEC: { actions: assign({ count: (ctx) => ctx.count - 1 }) },
              FORWARD_DEC: {
                actions: sendTo('child', { type: 'FORWARD_DEC' })
              }
            }
          },
          stop: {
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

    let state: any;
    const service = interpret(someParentMachine);
    service.subscribe((s) => {
      state = s;
    });
    service
      .onDone(() => {
        // 1. The 'parent' machine will not do anything (inert transition)
        // 2. The 'FORWARD_DEC' event will be "forwarded" to the 'child' machine
        // 3. On the 'child' machine, the 'FORWARD_DEC' event sends the 'DEC' action to the 'parent' thrice
        // 4. The context of the 'parent' machine will be updated from 2 to -1

        expect(state.context).toEqual({ count: -3 });
      })
      .start();

    service.send({ type: 'FORWARD_DEC' });
  });

  it('should start services (explicit machine, invoke = config)', (done) => {
    const childMachine = createMachine<{ userId: string | undefined }>({
      id: 'fetch',
      context: ({ input }) => ({
        userId: input.userId
      }),
      initial: 'pending',
      states: {
        pending: {
          entry: send({ type: 'RESOLVE', user }),
          on: {
            RESOLVE: {
              target: 'success',
              guard: (ctx) => {
                return ctx.userId !== undefined;
              }
            }
          }
        },
        success: {
          type: 'final',
          data: { user: (_: any, e: any) => e.user }
        },
        failure: {
          entry: sendParent({ type: 'REJECT' })
        }
      }
    });

    const machine = createMachine({
      id: 'fetcher',
      initial: 'idle',
      context: {
        selectedUserId: '42',
        user: undefined
      },
      states: {
        idle: {
          on: {
            GO_TO_WAITING: 'waiting'
          }
        },
        waiting: {
          invoke: {
            src: childMachine,
            input: {
              userId: (ctx: any) => ctx.selectedUserId
            },
            onDone: {
              target: 'received',
              guard: (_, e) => {
                // Should receive { user: { name: 'David' } } as event data
                return e.data.user.name === 'David';
              }
            }
          }
        },
        received: {
          type: 'final'
        }
      }
    });

    interpret(machine)
      .onDone(() => {
        done();
      })
      .start()
      .send({ type: 'GO_TO_WAITING' });
  });

  it('should start services (explicit machine, invoke = machine)', (done) => {
    interpret(fetcherMachine)
      .onDone((_) => {
        done();
      })
      .start()
      .send({ type: 'GO_TO_WAITING_MACHINE' });
  });

  it('should start services (machine as invoke config)', (done) => {
    const machineInvokeMachine = createMachine<
      any,
      { type: 'SUCCESS'; data: number }
    >({
      id: 'machine-invoke',
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: createMachine({
              id: 'child',
              initial: 'sending',
              states: {
                sending: {
                  entry: sendParent({ type: 'SUCCESS', data: 42 })
                }
              }
            })
          },
          on: {
            SUCCESS: {
              target: 'success',
              guard: (_, e) => {
                return e.data === 42;
              }
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    interpret(machineInvokeMachine)
      .onDone(() => done())
      .start();
  });

  it('should start deeply nested service (machine as invoke config)', (done) => {
    const machineInvokeMachine = createMachine<
      any,
      { type: 'SUCCESS'; data: number }
    >({
      id: 'parent',
      initial: 'a',
      states: {
        a: {
          initial: 'b',
          states: {
            b: {
              invoke: {
                src: createMachine({
                  id: 'child',
                  initial: 'sending',
                  states: {
                    sending: {
                      entry: sendParent({ type: 'SUCCESS', data: 42 })
                    }
                  }
                })
              }
            }
          }
        },
        success: {
          id: 'success',
          type: 'final'
        }
      },
      on: {
        SUCCESS: {
          target: 'success',
          guard: (_, e) => {
            return e.data === 42;
          }
        }
      }
    });

    interpret(machineInvokeMachine)
      .onDone(() => done())
      .start();
  });

  it('should use the service overwritten by .provide(...)', (done) => {
    const childMachine = createMachine({
      id: 'child',
      initial: 'init',
      states: {
        init: {}
      }
    });

    const someParentMachine = createMachine(
      {
        id: 'parent',
        context: { count: 0 },
        initial: 'start',
        states: {
          start: {
            invoke: {
              src: 'child',
              id: 'someService'
            },
            on: {
              STOP: 'stop'
            }
          },
          stop: {
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

    interpret(
      someParentMachine.provide({
        actors: {
          child: createMachine({
            id: 'child',
            initial: 'init',
            states: {
              init: {
                entry: [sendParent({ type: 'STOP' })]
              }
            }
          })
        }
      })
    )
      .onDone(() => {
        done();
      })
      .start();
  });

  describe('parent to child', () => {
    const subMachine = createMachine({
      id: 'child',
      initial: 'one',
      states: {
        one: {
          on: { NEXT: 'two' }
        },
        two: {
          entry: sendParent({ type: 'NEXT' })
        }
      }
    });

    it('should communicate with the child machine (invoke on machine)', (done) => {
      const mainMachine = createMachine({
        id: 'parent',
        initial: 'one',
        invoke: {
          id: 'foo-child',
          src: subMachine
        },
        states: {
          one: {
            entry: sendTo('foo-child', { type: 'NEXT' }),
            on: { NEXT: 'two' }
          },
          two: {
            type: 'final'
          }
        }
      });

      interpret(mainMachine)
        .onDone(() => {
          done();
        })
        .start();
    });

    it('should communicate with the child machine (invoke on state)', (done) => {
      const mainMachine = createMachine({
        id: 'parent',
        initial: 'one',
        states: {
          one: {
            invoke: {
              id: 'foo-child',
              src: subMachine
            },
            entry: sendTo('foo-child', { type: 'NEXT' }),
            on: { NEXT: 'two' }
          },
          two: {
            type: 'final'
          }
        }
      });

      interpret(mainMachine)
        .onDone(() => {
          done();
        })
        .start();
    });

    it('should transition correctly if child invocation causes it to directly go to final state', () => {
      const doneSubMachine = createMachine({
        id: 'child',
        initial: 'one',
        states: {
          one: {
            on: { NEXT: 'two' }
          },
          two: {
            type: 'final'
          }
        }
      });

      const mainMachine = createMachine({
        id: 'parent',
        initial: 'one',
        states: {
          one: {
            invoke: {
              id: 'foo-child',
              src: doneSubMachine,
              onDone: 'two'
            },
            entry: sendTo('foo-child', { type: 'NEXT' })
          },
          two: {
            on: { NEXT: 'three' }
          },
          three: {
            type: 'final'
          }
        }
      });

      const actor = interpret(mainMachine).start();

      expect(actor.getSnapshot().value).toBe('two');
    });

    it('should work with invocations defined in orthogonal state nodes', (done) => {
      const pongMachine = createMachine({
        id: 'pong',
        initial: 'active',
        states: {
          active: {
            type: 'final',
            data: { secret: 'pingpong' }
          }
        }
      });

      const pingMachine = createMachine({
        id: 'ping',
        type: 'parallel',
        states: {
          one: {
            initial: 'active',
            states: {
              active: {
                invoke: {
                  id: 'pong',
                  src: pongMachine,
                  onDone: {
                    target: 'success',
                    guard: (_, e) => e.data.secret === 'pingpong'
                  }
                }
              },
              success: {
                type: 'final'
              }
            }
          }
        }
      });

      interpret(pingMachine)
        .onDone(() => {
          done();
        })
        .start();
    });

    it('should not reinvoke root-level invocations', (done) => {
      // https://github.com/statelyai/xstate/issues/2147

      let invokeCount = 0;
      let invokeDisposeCount = 0;
      let actionsCount = 0;
      let entryActionsCount = 0;

      const machine = createMachine({
        invoke: {
          src: fromCallback(() => {
            invokeCount++;

            return () => {
              invokeDisposeCount++;
            };
          })
        },
        entry: () => entryActionsCount++,
        on: {
          UPDATE: {
            actions: () => {
              actionsCount++;
            }
          }
        }
      });

      const service = interpret(machine).start();
      expect(entryActionsCount).toEqual(1);
      expect(invokeCount).toEqual(1);
      expect(invokeDisposeCount).toEqual(0);
      expect(actionsCount).toEqual(0);

      service.send({ type: 'UPDATE' });
      expect(entryActionsCount).toEqual(1);
      expect(invokeCount).toEqual(1);
      expect(invokeDisposeCount).toEqual(0);
      expect(actionsCount).toEqual(1);

      service.send({ type: 'UPDATE' });
      expect(entryActionsCount).toEqual(1);
      expect(invokeCount).toEqual(1);
      expect(invokeDisposeCount).toEqual(0);
      expect(actionsCount).toEqual(2);
      done();
    });

    it('should stop a child actor when reaching a final state', () => {
      let actorStopped = false;

      const machine = createMachine({
        id: 'machine',
        invoke: {
          src: fromCallback(() => () => (actorStopped = true))
        },
        initial: 'running',
        states: {
          running: {
            on: {
              finished: 'complete'
            }
          },
          complete: { type: 'final' }
        }
      });

      const service = interpret(machine).start();

      service.send({
        type: 'finished'
      });

      expect(actorStopped).toBe(true);
    });

    it('child should not invoke an actor when it transitions to an invoking state when it gets stopped by its parent', (done) => {
      let invokeCount = 0;

      const child = createMachine({
        id: 'child',
        initial: 'idle',
        states: {
          idle: {
            invoke: {
              src: fromCallback((sendBack) => {
                invokeCount++;

                if (invokeCount > 1) {
                  // prevent a potential infinite loop
                  throw new Error('This should be impossible.');
                }

                // it's important for this test to send the event back when the parent is *not* currently processing an event
                // this ensures that the parent can process the received event immediately and can stop the child immediately
                setTimeout(() => sendBack({ type: 'STARTED' }));
              })
            },
            on: {
              STARTED: 'active'
            }
          },
          active: {
            invoke: {
              src: fromCallback((sendBack) => {
                sendBack({ type: 'STOPPED' });
              })
            },
            on: {
              STOPPED: {
                target: 'idle',
                actions: forwardTo(SpecialTargets.Parent)
              }
            }
          }
        }
      });
      const parent = createMachine({
        id: 'parent',
        initial: 'idle',
        states: {
          idle: {
            on: {
              START: 'active'
            }
          },
          active: {
            invoke: { src: child },
            on: {
              STOPPED: 'done'
            }
          },
          done: {
            type: 'final'
          }
        }
      });

      const service = interpret(parent)
        .onDone(() => {
          expect(invokeCount).toBe(1);
          done();
        })
        .start();

      service.send({ type: 'START' });
    });
  });

  type PromiseExecutor = (
    resolve: (value?: any) => void,
    reject: (reason?: any) => void
  ) => void;

  const promiseTypes = [
    {
      type: 'Promise',
      createPromise(executor: PromiseExecutor): Promise<any> {
        return new Promise(executor);
      }
    },
    {
      type: 'PromiseLike',
      createPromise(executor: PromiseExecutor): PromiseLike<any> {
        // Simulate a Promise/A+ thenable / polyfilled Promise.
        function createThenable(promise: Promise<any>): PromiseLike<any> {
          return {
            then(onfulfilled, onrejected) {
              return createThenable(promise.then(onfulfilled, onrejected));
            }
          };
        }
        return createThenable(new Promise(executor));
      }
    }
  ];

  promiseTypes.forEach(({ type, createPromise }) => {
    describe(`with promises (${type})`, () => {
      const invokePromiseMachine = createMachine({
        id: 'invokePromise',
        initial: 'pending',
        context: ({ input }) => ({
          id: 42,
          succeed: true,
          ...input
        }),
        states: {
          pending: {
            invoke: {
              src: fromPromise(({ input }) =>
                createPromise((resolve) => {
                  if (input.succeed) {
                    resolve(input.id);
                  } else {
                    throw new Error(`failed on purpose for: ${input.id}`);
                  }
                })
              ),
              input: (ctx) => ctx,
              onDone: {
                target: 'success',
                guard: (ctx, e) => {
                  return e.data === ctx.id;
                }
              },
              onError: 'failure'
            }
          },
          success: {
            type: 'final'
          },
          failure: {
            type: 'final'
          }
        }
      });

      it('should be invoked with a promise factory and resolve through onDone', (done) => {
        const service = interpret(invokePromiseMachine)
          .onDone(() => {
            expect(service.getSnapshot()._event.origin).toBeDefined();
            done();
          })
          .start();
      });

      it('should be invoked with a promise factory and reject with ErrorExecution', (done) => {
        interpret(invokePromiseMachine, { input: { id: 31, succeed: false } })
          .onDone(() => done())
          .start();
      });

      it('should be invoked with a promise factory and surface any unhandled errors', (done) => {
        const promiseMachine = createMachine({
          id: 'invokePromise',
          initial: 'pending',
          states: {
            pending: {
              invoke: {
                src: fromPromise(() =>
                  createPromise(() => {
                    throw new Error('test');
                  })
                ),
                onDone: 'success'
              }
            },
            success: {
              type: 'final'
            }
          }
        });

        const service = interpret(promiseMachine);
        service.subscribe({
          error(err) {
            expect(err.message).toEqual(expect.stringMatching(/test/));
            done();
          }
        });
        service.start();
      });

      // tslint:disable-next-line:max-line-length
      it('should be invoked with a promise factory and stop on unhandled onError target when on strict mode', (done) => {
        const doneSpy = jest.fn();

        const promiseMachine = createMachine({
          id: 'invokePromise',
          initial: 'pending',
          strict: true,
          states: {
            pending: {
              invoke: {
                src: fromPromise(() =>
                  createPromise(() => {
                    throw new Error('test');
                  })
                ),
                onDone: 'success'
              }
            },
            success: {
              type: 'final'
            }
          }
        });

        const actor = interpret(promiseMachine);

        actor.onDone(doneSpy);
        actor.subscribe({
          error: (err) => {
            // TODO: determine if err should be the full SCXML error event
            expect(err).toBeInstanceOf(Error);
            expect(err.message).toBe('test');
          }
        });
        actor.start();

        actor.subscribe({
          complete() {
            expect(doneSpy).not.toHaveBeenCalled();
            done();
          }
        });
      });

      it('should be invoked with a promise factory and resolve through onDone for compound state nodes', (done) => {
        const promiseMachine = createMachine({
          id: 'promise',
          initial: 'parent',
          states: {
            parent: {
              initial: 'pending',
              states: {
                pending: {
                  invoke: {
                    src: fromPromise(() =>
                      createPromise((resolve) => resolve())
                    ),
                    onDone: 'success'
                  }
                },
                success: {
                  type: 'final'
                }
              },
              onDone: 'success'
            },
            success: {
              type: 'final'
            }
          }
        });

        interpret(promiseMachine)
          .onDone(() => done())
          .start();
      });

      it('should be invoked with a promise service and resolve through onDone for compound state nodes', (done) => {
        const promiseMachine = createMachine(
          {
            id: 'promise',
            initial: 'parent',
            states: {
              parent: {
                initial: 'pending',
                states: {
                  pending: {
                    invoke: {
                      src: 'somePromise',
                      onDone: 'success'
                    }
                  },
                  success: {
                    type: 'final'
                  }
                },
                onDone: 'success'
              },
              success: {
                type: 'final'
              }
            }
          },
          {
            actors: {
              somePromise: fromPromise(() =>
                createPromise((resolve) => resolve())
              )
            }
          }
        );

        interpret(promiseMachine)
          .onDone(() => done())
          .start();
      });

      it('should assign the resolved data when invoked with a promise factory', (done) => {
        const promiseMachine = createMachine<{ count: number }>({
          id: 'promise',
          context: { count: 0 },
          initial: 'pending',
          states: {
            pending: {
              invoke: {
                src: fromPromise(() =>
                  createPromise((resolve) => resolve({ count: 1 }))
                ),
                onDone: {
                  target: 'success',
                  actions: assign({ count: (_, e) => e.data.count })
                }
              }
            },
            success: {
              type: 'final'
            }
          }
        });

        const actor = interpret(promiseMachine)
          .onDone(() => {
            expect(actor.getSnapshot().context.count).toEqual(1);
            done();
          })
          .start();
      });

      it('should assign the resolved data when invoked with a promise service', (done) => {
        const promiseMachine = createMachine<{ count: number }>(
          {
            id: 'promise',
            context: { count: 0 },
            initial: 'pending',
            states: {
              pending: {
                invoke: {
                  src: 'somePromise',
                  onDone: {
                    target: 'success',
                    actions: assign({ count: (_, e) => e.data.count })
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
              somePromise: fromPromise(() =>
                createPromise((resolve) => resolve({ count: 1 }))
              )
            }
          }
        );

        const actor = interpret(promiseMachine)
          .onDone(() => {
            expect(actor.getSnapshot().context.count).toEqual(1);
            done();
          })
          .start();
      });

      it('should provide the resolved data when invoked with a promise factory', (done) => {
        let count = 0;

        const promiseMachine = createMachine({
          id: 'promise',
          context: { count: 0 },
          initial: 'pending',
          states: {
            pending: {
              invoke: {
                src: fromPromise(() =>
                  createPromise((resolve) => resolve({ count: 1 }))
                ),
                onDone: {
                  target: 'success',
                  actions: (_, e) => {
                    count = e.data.count;
                  }
                }
              }
            },
            success: {
              type: 'final'
            }
          }
        });

        interpret(promiseMachine)
          .onDone(() => {
            expect(count).toEqual(1);
            done();
          })
          .start();
      });

      it('should provide the resolved data when invoked with a promise service', (done) => {
        let count = 0;

        const promiseMachine = createMachine(
          {
            id: 'promise',
            initial: 'pending',
            states: {
              pending: {
                invoke: {
                  src: 'somePromise',
                  onDone: {
                    target: 'success',
                    actions: (_, e) => {
                      count = e.data.count;
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
              somePromise: fromPromise(() =>
                createPromise((resolve) => resolve({ count: 1 }))
              )
            }
          }
        );

        interpret(promiseMachine)
          .onDone(() => {
            expect(count).toEqual(1);
            done();
          })
          .start();
      });

      it('should be able to specify a Promise as a service', (done) => {
        interface BeginEvent {
          type: 'BEGIN';
          payload: boolean;
        }
        const promiseMachine = createMachine<{ foo: boolean }, BeginEvent>(
          {
            id: 'promise',
            initial: 'pending',
            context: {
              foo: true
            },
            states: {
              pending: {
                on: {
                  BEGIN: 'first'
                }
              },
              first: {
                invoke: {
                  src: 'somePromise',
                  input: (ctx, ev) => ({
                    foo: ctx.foo,
                    event: ev
                  }),
                  onDone: 'last'
                }
              },
              last: {
                type: 'final'
              }
            }
          },
          {
            actors: {
              somePromise: fromPromise(({ input }) => {
                return createPromise((resolve, reject) => {
                  input.foo && input.event.payload ? resolve() : reject();
                });
              })
            }
          }
        );

        interpret(promiseMachine)
          .onDone(() => done())
          .start()
          .send({
            type: 'BEGIN',
            payload: true
          });
      });

      it('should be able to reuse the same promise behavior multiple times and create unique promise for each created actor', (done) => {
        const machine = createMachine<{
          result1: number | null;
          result2: number | null;
        }>(
          {
            context: {
              result1: null,
              result2: null
            },
            initial: 'pending',
            states: {
              pending: {
                type: 'parallel',
                states: {
                  state1: {
                    initial: 'active',
                    states: {
                      active: {
                        invoke: {
                          src: 'getRandomNumber',
                          onDone: {
                            target: 'success',
                            actions: assign((_ctx, ev) => ({
                              result1: ev.data.result
                            }))
                          }
                        }
                      },
                      success: {
                        type: 'final'
                      }
                    }
                  },
                  state2: {
                    initial: 'active',
                    states: {
                      active: {
                        invoke: {
                          src: 'getRandomNumber',
                          onDone: {
                            target: 'success',
                            actions: assign((_ctx, ev) => ({
                              result2: ev.data.result
                            }))
                          }
                        }
                      },
                      success: {
                        type: 'final'
                      }
                    }
                  }
                },
                onDone: 'done'
              },
              done: {
                type: 'final'
              }
            }
          },
          {
            actors: {
              // it's important for this actor to be reused, this test shouldn't use a factory or anything like that
              getRandomNumber: fromPromise(() => {
                return createPromise((resolve) =>
                  resolve({ result: Math.random() })
                );
              })
            }
          }
        );

        const service = interpret(machine)
          .onDone(() => {
            const snapshot = service.getSnapshot();
            expect(typeof snapshot.context.result1).toBe('number');
            expect(typeof snapshot.context.result2).toBe('number');
            expect(snapshot.context.result1).not.toBe(snapshot.context.result2);
            done();
          })
          .start();
      });
    });
  });

  describe('with callbacks', () => {
    it('should be able to specify a callback as a service', (done) => {
      interface BeginEvent {
        type: 'BEGIN';
        payload: boolean;
      }
      interface CallbackEvent {
        type: 'CALLBACK';
        data: number;
      }
      const callbackMachine = createMachine<
        {
          foo: boolean;
        },
        BeginEvent | CallbackEvent
      >(
        {
          id: 'callback',
          initial: 'pending',
          context: {
            foo: true
          },
          states: {
            pending: {
              on: {
                BEGIN: 'first'
              }
            },
            first: {
              invoke: {
                src: 'someCallback',
                input: (ctx, ev) => ({
                  foo: ctx.foo,
                  event: ev
                })
              },
              on: {
                CALLBACK: {
                  target: 'last',
                  guard: (_, e) => e.data === 42
                }
              }
            },
            last: {
              type: 'final'
            }
          }
        },
        {
          actors: {
            someCallback: fromCallback((cb, _receive, { input }) => {
              if (input.foo && input.event.type === 'BEGIN') {
                cb({
                  type: 'CALLBACK',
                  data: 40
                });
                cb({
                  type: 'CALLBACK',
                  data: 41
                });
                cb({
                  type: 'CALLBACK',
                  data: 42
                });
              }
            })
          }
        }
      );

      interpret(callbackMachine)
        .onDone(() => done())
        .start()
        .send({
          type: 'BEGIN',
          payload: true
        });
    });

    it('should transition correctly if callback function sends an event', () => {
      const callbackMachine = createMachine(
        {
          id: 'callback',
          initial: 'pending',
          context: { foo: true },
          states: {
            pending: {
              on: { BEGIN: 'first' }
            },
            first: {
              invoke: {
                src: 'someCallback'
              },
              on: { CALLBACK: 'intermediate' }
            },
            intermediate: {
              on: { NEXT: 'last' }
            },
            last: {
              type: 'final'
            }
          }
        },
        {
          actors: {
            someCallback: fromCallback((cb) => {
              cb({ type: 'CALLBACK' });
            })
          }
        }
      );

      const expectedStateValues = ['pending', 'first', 'intermediate'];
      const stateValues: StateValue[] = [];
      const actor = interpret(callbackMachine);
      actor.subscribe((current) => stateValues.push(current.value));
      actor.start().send({ type: 'BEGIN' });
      for (let i = 0; i < expectedStateValues.length; i++) {
        expect(stateValues[i]).toEqual(expectedStateValues[i]);
      }
    });

    it('should transition correctly if callback function invoked from start and sends an event', () => {
      const callbackMachine = createMachine(
        {
          id: 'callback',
          initial: 'idle',
          context: { foo: true },
          states: {
            idle: {
              invoke: {
                src: 'someCallback'
              },
              on: { CALLBACK: 'intermediate' }
            },
            intermediate: {
              on: { NEXT: 'last' }
            },
            last: {
              type: 'final'
            }
          }
        },
        {
          actors: {
            someCallback: fromCallback((cb) => {
              cb({ type: 'CALLBACK' });
            })
          }
        }
      );

      const expectedStateValues = ['idle', 'intermediate'];
      const stateValues: StateValue[] = [];
      const actor = interpret(callbackMachine);
      actor.subscribe((current) => stateValues.push(current.value));
      actor.start().send({ type: 'BEGIN' });
      for (let i = 0; i < expectedStateValues.length; i++) {
        expect(stateValues[i]).toEqual(expectedStateValues[i]);
      }
    });

    // tslint:disable-next-line:max-line-length
    it('should transition correctly if transient transition happens before current state invokes callback function and sends an event', () => {
      const callbackMachine = createMachine(
        {
          id: 'callback',
          initial: 'pending',
          context: { foo: true },
          states: {
            pending: {
              on: { BEGIN: 'first' }
            },
            first: {
              always: 'second'
            },
            second: {
              invoke: {
                src: 'someCallback'
              },
              on: { CALLBACK: 'third' }
            },
            third: {
              on: { NEXT: 'last' }
            },
            last: {
              type: 'final'
            }
          }
        },
        {
          actors: {
            someCallback: fromCallback((cb) => {
              cb({ type: 'CALLBACK' });
            })
          }
        }
      );

      const expectedStateValues = ['pending', 'second', 'third'];
      const stateValues: StateValue[] = [];
      const actor = interpret(callbackMachine);
      actor.subscribe((current) => {
        stateValues.push(current.value);
      });
      actor.start().send({ type: 'BEGIN' });

      for (let i = 0; i < expectedStateValues.length; i++) {
        expect(stateValues[i]).toEqual(expectedStateValues[i]);
      }
    });

    it('should treat a callback source as an event stream', (done) => {
      const intervalMachine = createMachine<{
        count: number;
      }>({
        id: 'interval',
        initial: 'counting',
        context: {
          count: 0
        },
        states: {
          counting: {
            invoke: {
              id: 'intervalService',
              src: fromCallback((cb) => {
                const ivl = setInterval(() => {
                  cb({ type: 'INC' });
                }, 10);

                return () => clearInterval(ivl);
              })
            },
            always: {
              target: 'finished',
              guard: (ctx) => ctx.count === 3
            },
            on: {
              INC: { actions: assign({ count: (ctx) => ctx.count + 1 }) }
            }
          },
          finished: {
            type: 'final'
          }
        }
      });
      interpret(intervalMachine)
        .onDone(() => done())
        .start();
    });

    it('should dispose of the callback (if disposal function provided)', () => {
      const spy = jest.fn();
      const intervalMachine = createMachine({
        id: 'interval',
        initial: 'counting',
        states: {
          counting: {
            invoke: {
              id: 'intervalService',
              src: fromCallback(() => spy)
            },
            on: {
              NEXT: 'idle'
            }
          },
          idle: {}
        }
      });
      const actorRef = interpret(intervalMachine).start();

      actorRef.send({ type: 'NEXT' });

      expect(spy).toHaveBeenCalled();
    });

    it('callback should be able to receive messages from parent', (done) => {
      const pingPongMachine = createMachine({
        id: 'ping-pong',
        initial: 'active',
        states: {
          active: {
            invoke: {
              id: 'child',
              src: fromCallback((callback, onReceive) => {
                onReceive((e) => {
                  if (e.type === 'PING') {
                    callback({ type: 'PONG' });
                  }
                });
              })
            },
            entry: sendTo('child', { type: 'PING' }),
            on: {
              PONG: 'done'
            }
          },
          done: {
            type: 'final'
          }
        }
      });

      interpret(pingPongMachine)
        .onDone(() => done())
        .start();
    });

    it('should call onError upon error (sync)', (done) => {
      const errorMachine = createMachine({
        id: 'error',
        initial: 'safe',
        states: {
          safe: {
            invoke: {
              src: fromCallback(() => {
                throw new Error('test');
              }),
              onError: {
                target: 'failed',
                guard: (_, e) => {
                  return e.data instanceof Error && e.data.message === 'test';
                }
              }
            }
          },
          failed: {
            type: 'final'
          }
        }
      });

      interpret(errorMachine)
        .onDone(() => done())
        .start();
    });

    it('should transition correctly upon error (sync)', () => {
      const errorMachine = createMachine({
        id: 'error',
        initial: 'safe',
        states: {
          safe: {
            invoke: {
              src: fromCallback(() => {
                throw new Error('test');
              }),
              onError: 'failed'
            }
          },
          failed: {
            on: { RETRY: 'safe' }
          }
        }
      });

      const expectedStateValue = 'failed';
      const service = interpret(errorMachine).start();
      expect(service.getSnapshot().value).toEqual(expectedStateValue);
    });

    it('should call onError upon error (async)', (done) => {
      const errorMachine = createMachine({
        id: 'asyncError',
        initial: 'safe',
        states: {
          safe: {
            invoke: {
              src: fromCallback(async () => {
                await true;
                throw new Error('test');
              }),
              onError: {
                target: 'failed',
                guard: (_, e) => {
                  return e.data instanceof Error && e.data.message === 'test';
                }
              }
            }
          },
          failed: {
            type: 'final'
          }
        }
      });

      interpret(errorMachine)
        .onDone(() => done())
        .start();
    });

    it('should call onDone when resolved (async)', (done) => {
      const asyncWithDoneMachine = createMachine<{ result?: any }>({
        id: 'async',
        initial: 'fetch',
        context: { result: undefined },
        states: {
          fetch: {
            invoke: {
              src: fromCallback(async () => {
                await true;
                return 42;
              }),
              onDone: {
                target: 'success',
                actions: assign((_, { data: result }) => ({ result }))
              }
            }
          },
          success: {
            type: 'final'
          }
        }
      });

      const actor = interpret(asyncWithDoneMachine)
        .onDone(() => {
          expect(actor.getSnapshot().context.result).toEqual(42);
          done();
        })
        .start();
    });

    it('should call onError only on the state which has invoked failed service', () => {
      let errorHandlersCalled = 0;

      const errorMachine = createMachine({
        initial: 'start',
        states: {
          start: {
            on: {
              FETCH: 'fetch'
            }
          },
          fetch: {
            type: 'parallel',
            states: {
              first: {
                invoke: {
                  src: fromCallback(() => {
                    throw new Error('test');
                  }),
                  onError: {
                    target: 'failed',
                    guard: () => {
                      errorHandlersCalled++;
                      return false;
                    }
                  }
                }
              },
              second: {
                invoke: {
                  src: fromCallback(() => {
                    // empty
                  }),
                  onError: {
                    target: 'failed',
                    guard: () => {
                      errorHandlersCalled++;
                      return false;
                    }
                  }
                }
              },
              failed: {
                type: 'final'
              }
            }
          }
        }
      });

      interpret(errorMachine).start().send({ type: 'FETCH' });

      expect(errorHandlersCalled).toEqual(1);
    });

    it('should be able to be stringified', () => {
      const waitingState = fetcherMachine.transition(
        fetcherMachine.initialState,
        { type: 'GO_TO_WAITING' }
      );

      expect(() => {
        JSON.stringify(waitingState);
      }).not.toThrow();

      expect(typeof waitingState.actions[0].params?.src).toBe('string');
    });

    it('should throw error if unhandled (sync)', () => {
      const errorMachine = createMachine({
        id: 'asyncError',
        initial: 'safe',
        states: {
          safe: {
            invoke: {
              src: fromCallback(() => {
                throw new Error('test');
              })
            }
          },
          failed: {
            type: 'final'
          }
        }
      });

      const service = interpret(errorMachine);
      expect(() => service.start()).toThrow();
    });

    describe('sub invoke race condition', () => {
      const anotherChildMachine = createMachine({
        id: 'child',
        initial: 'start',
        states: {
          start: {
            on: { STOP: 'end' }
          },
          end: {
            type: 'final'
          }
        }
      });

      const anotherParentMachine = createMachine({
        id: 'parent',
        initial: 'begin',
        states: {
          begin: {
            invoke: {
              src: anotherChildMachine,
              id: 'invoked.child',
              onDone: 'completed'
            },
            on: {
              STOPCHILD: {
                actions: sendTo('invoked.child', { type: 'STOP' })
              }
            }
          },
          completed: {
            type: 'final'
          }
        }
      });

      it('ends on the completed state', (done) => {
        const events: EventObject[] = [];
        let state: any;
        const service = interpret(anotherParentMachine);
        service.subscribe((s) => {
          state = s;
          events.push(s.event);
        });
        service
          .onDone(() => {
            expect(events.map((e) => e.type)).toEqual([
              actionTypes.init,
              'STOPCHILD',
              doneInvoke('invoked.child').type
            ]);
            expect(state.value).toEqual('completed');
            done();
          })
          .start();

        service.send({ type: 'STOPCHILD' });
      });
    });
  });

  describe('with observables', () => {
    it('should work with an infinite observable', (done) => {
      interface Events {
        type: 'COUNT';
        value: number;
      }
      const obsMachine = createMachine<{ count: number | undefined }, Events>({
        id: 'infiniteObs',
        initial: 'counting',
        context: { count: undefined },
        states: {
          counting: {
            invoke: {
              src: fromObservable(() => interval(10)),
              onSnapshot: {
                actions: assign({ count: (_, e) => e.data })
              }
            },
            always: {
              target: 'counted',
              guard: (ctx) => ctx.count === 5
            }
          },
          counted: {
            type: 'final'
          }
        }
      });

      const service = interpret(obsMachine)
        .onDone(() => {
          expect(service.getSnapshot()._event.origin).toBeDefined();
          done();
        })
        .start();
    });

    it('should work with a finite observable', (done) => {
      interface Ctx {
        count: number | undefined;
      }
      interface Events {
        type: 'COUNT';
        value: number;
      }
      const obsMachine = createMachine<Ctx, Events>({
        id: 'obs',
        initial: 'counting',
        context: {
          count: undefined
        },
        states: {
          counting: {
            invoke: {
              src: fromObservable(() => interval(10).pipe(take(5))),
              onSnapshot: {
                actions: assign({
                  count: (_, e) => e.data
                })
              },
              onDone: {
                target: 'counted',
                guard: (ctx) => ctx.count === 4
              }
            }
          },
          counted: {
            type: 'final'
          }
        }
      });

      interpret(obsMachine)
        .onDone(() => {
          done();
        })
        .start();
    });

    it('should receive an emitted error', (done) => {
      interface Ctx {
        count: number | undefined;
      }
      interface Events {
        type: 'COUNT';
        value: number;
      }
      const obsMachine = createMachine<Ctx, Events>({
        id: 'obs',
        initial: 'counting',
        context: { count: undefined },
        states: {
          counting: {
            invoke: {
              src: fromObservable(() =>
                interval(10).pipe(
                  map((value) => {
                    if (value === 5) {
                      throw new Error('some error');
                    }

                    return value;
                  })
                )
              ),
              onSnapshot: {
                actions: assign({ count: (_, e) => e.data })
              },
              onError: {
                target: 'success',
                guard: (ctx, e) => {
                  expect(e.data.message).toEqual('some error');
                  return ctx.count === 4 && e.data.message === 'some error';
                }
              }
            }
          },
          success: {
            type: 'final'
          }
        }
      });

      interpret(obsMachine)
        .onDone(() => {
          done();
        })
        .start();
    });
  });

  describe('with event observables', () => {
    it('should work with an infinite event observable', (done) => {
      interface Events {
        type: 'COUNT';
        value: number;
      }
      const obsMachine = createMachine<{ count: number | undefined }, Events>({
        id: 'obs',
        initial: 'counting',
        context: { count: undefined },
        states: {
          counting: {
            invoke: {
              src: fromEventObservable(() =>
                interval(10).pipe(map((value) => ({ type: 'COUNT', value })))
              )
            },
            on: {
              COUNT: {
                actions: assign({ count: (_, e) => e.value })
              }
            },
            always: {
              target: 'counted',
              guard: (ctx) => ctx.count === 5
            }
          },
          counted: {
            type: 'final'
          }
        }
      });

      const service = interpret(obsMachine)
        .onDone(() => {
          expect(service.getSnapshot()._event.origin).toBeDefined();
          done();
        })
        .start();
    });

    it('should work with a finite event observable', (done) => {
      interface Ctx {
        count: number | undefined;
      }
      interface Events {
        type: 'COUNT';
        value: number;
      }
      const obsMachine = createMachine<Ctx, Events>({
        id: 'obs',
        initial: 'counting',
        context: {
          count: undefined
        },
        states: {
          counting: {
            invoke: {
              src: fromEventObservable(() =>
                interval(10).pipe(
                  take(5),
                  map((value) => ({ type: 'COUNT', value }))
                )
              ),
              onDone: {
                target: 'counted',
                guard: (ctx) => ctx.count === 4
              }
            },
            on: {
              COUNT: {
                actions: assign({
                  count: (_, e) => e.value
                })
              }
            }
          },
          counted: {
            type: 'final'
          }
        }
      });

      interpret(obsMachine)
        .onDone(() => {
          done();
        })
        .start();
    });

    it('should receive an emitted error', (done) => {
      interface Ctx {
        count: number | undefined;
      }
      interface Events {
        type: 'COUNT';
        value: number;
      }
      const obsMachine = createMachine<Ctx, Events>({
        id: 'obs',
        initial: 'counting',
        context: { count: undefined },
        states: {
          counting: {
            invoke: {
              src: fromEventObservable(() =>
                interval(10).pipe(
                  map((value) => {
                    if (value === 5) {
                      throw new Error('some error');
                    }

                    return { type: 'COUNT', value };
                  })
                )
              ),
              onError: {
                target: 'success',
                guard: (ctx, e) => {
                  expect(e.data.message).toEqual('some error');
                  return ctx.count === 4 && e.data.message === 'some error';
                }
              }
            },
            on: {
              COUNT: {
                actions: assign({ count: (_, e) => e.value })
              }
            }
          },
          success: {
            type: 'final'
          }
        }
      });

      interpret(obsMachine)
        .onDone(() => {
          done();
        })
        .start();
    });
  });

  describe('with behaviors', () => {
    it('should work with a behavior', (done) => {
      const countBehavior: ActorBehavior<EventObject, number> = {
        transition: (count, event) => {
          // TODO: all behaviors receive SCXML.Event objects,
          // make sure this is clear in the docs
          const _event = toSCXMLEvent(event);
          if (_event.name === 'INC') {
            return count + 1;
          } else if (_event.name === 'DEC') {
            return count - 1;
          }
          return count;
        },
        getInitialState: () => 0
      };

      const countMachine = createMachine({
        invoke: {
          id: 'count',
          src: countBehavior
        },
        on: {
          INC: {
            actions: forwardTo('count')
          }
        }
      });

      const countService = interpret(countMachine);
      countService.subscribe((state) => {
        if (state.children['count']?.getSnapshot() === 2) {
          done();
        }
      });
      countService.start();

      countService.send({ type: 'INC' });
      countService.send({ type: 'INC' });
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

      const pingMachine = createMachine({
        initial: 'waiting',
        states: {
          waiting: {
            entry: sendTo('ponger', { type: 'PING' }),
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

  describe('with transition functions', () => {
    it('should work with a transition function', (done) => {
      const countReducer = (
        count: number,
        event: { type: 'INC' } | { type: 'DEC' }
      ): number => {
        if (event.type === 'INC') {
          return count + 1;
        } else if (event.type === 'DEC') {
          return count - 1;
        }
        return count;
      };

      const countMachine = createMachine({
        invoke: {
          id: 'count',
          src: fromTransition(countReducer, 0)
        },
        on: {
          INC: {
            actions: forwardTo('count')
          }
        }
      });

      const countService = interpret(countMachine);
      countService.subscribe((state) => {
        if (state.children['count']?.getSnapshot() === 2) {
          done();
        }
      });
      countService.start();

      countService.send({ type: 'INC' });
      countService.send({ type: 'INC' });
    });

    it('should schedule events in a FIFO queue', (done) => {
      type CountEvents = { type: 'INC' } | { type: 'DOUBLE' };

      const countReducer = (
        count: number,
        event: CountEvents,
        { self }: ActorContext<CountEvents, any>
      ): number => {
        if (event.type === 'INC') {
          self.send({ type: 'DOUBLE' });
          return count + 1;
        }
        if (event.type === 'DOUBLE') {
          return count * 2;
        }

        return count;
      };

      const countMachine = createMachine({
        invoke: {
          id: 'count',
          src: fromTransition(countReducer, 0)
        },
        on: {
          INC: {
            actions: forwardTo('count')
          }
        }
      });

      const countService = interpret(countMachine);
      countService.subscribe((state) => {
        if (state.children['count']?.getSnapshot() === 2) {
          done();
        }
      });
      countService.start();

      countService.send({ type: 'INC' });
    });
  });

  describe('with machines', () => {
    const pongMachine = createMachine({
      id: 'pong',
      initial: 'active',
      states: {
        active: {
          on: {
            PING: {
              // Sends 'PONG' event to parent machine
              actions: sendParent({ type: 'PONG' })
            }
          }
        }
      }
    });

    // Parent machine
    const pingMachine = createMachine({
      id: 'ping',
      initial: 'innerMachine',
      states: {
        innerMachine: {
          initial: 'active',
          states: {
            active: {
              invoke: {
                id: 'pong',
                src: pongMachine
              },
              // Sends 'PING' event to child machine with ID 'pong'
              entry: sendTo('pong', { type: 'PING' }),
              on: {
                PONG: 'innerSuccess'
              }
            },
            innerSuccess: {
              type: 'final'
            }
          },
          onDone: 'success'
        },
        success: { type: 'final' }
      }
    });

    it('should create invocations from machines in nested states', (done) => {
      interpret(pingMachine)
        .onDone(() => done())
        .start();
    });
  });

  describe('multiple simultaneous services', () => {
    const multiple = createMachine<any>({
      id: 'machine',
      initial: 'one',

      context: {},

      on: {
        ONE: {
          actions: assign({
            one: 'one'
          })
        },

        TWO: {
          actions: assign({
            two: 'two'
          }),
          target: '.three'
        }
      },

      states: {
        one: {
          initial: 'two',
          states: {
            two: {
              invoke: [
                {
                  id: 'child',
                  src: fromCallback((cb) => cb({ type: 'ONE' }))
                },
                {
                  id: 'child2',
                  src: fromCallback((cb) => cb({ type: 'TWO' }))
                }
              ]
            }
          }
        },
        three: {
          type: 'final'
        }
      }
    });

    it('should start all services at once', (done) => {
      const service = interpret(multiple).onDone(() => {
        expect(service.getSnapshot().context).toEqual({
          one: 'one',
          two: 'two'
        });
        done();
      });

      service.start();
    });

    const parallel = createMachine<any>({
      id: 'machine',
      initial: 'one',

      context: {},

      on: {
        ONE: {
          actions: assign({
            one: 'one'
          })
        },

        TWO: {
          actions: assign({
            two: 'two'
          })
        }
      },

      after: {
        // allow both invoked services to get a chance to send their events
        // and don't depend on a potential race condition (with an immediate transition)
        10: '.three'
      },

      states: {
        one: {
          initial: 'two',
          states: {
            two: {
              type: 'parallel',
              states: {
                a: {
                  invoke: {
                    id: 'child',
                    src: fromCallback((cb) => cb({ type: 'ONE' }))
                  }
                },
                b: {
                  invoke: {
                    id: 'child2',
                    src: fromCallback((cb) => cb({ type: 'TWO' }))
                  }
                }
              }
            }
          }
        },
        three: {
          type: 'final'
        }
      }
    });

    it('should run services in parallel', (done) => {
      const service = interpret(parallel).onDone(() => {
        expect(service.getSnapshot().context).toEqual({
          one: 'one',
          two: 'two'
        });
        done();
      });

      service.start();
    });

    it('should not invoke an actor if it gets stopped immediately by transitioning away in immediate microstep', () => {
      // Since an actor will be canceled when the state machine leaves the invoking state
      // it does not make sense to start an actor in a state that will be exited immediately
      let actorStarted = false;

      const transientMachine = createMachine({
        id: 'transient',
        initial: 'active',
        states: {
          active: {
            invoke: {
              id: 'doNotInvoke',
              src: fromCallback(() => {
                actorStarted = true;
              })
            },
            always: 'inactive'
          },
          inactive: {}
        }
      });

      const service = interpret(transientMachine);

      service.start();

      expect(actorStarted).toBe(false);
    });

    // tslint:disable-next-line: max-line-length
    it('should not invoke an actor if it gets stopped immediately by transitioning away in subsequent microstep', () => {
      // Since an actor will be canceled when the state machine leaves the invoking state
      // it does not make sense to start an actor in a state that will be exited immediately
      let actorStarted = false;

      const transientMachine = createMachine({
        initial: 'withNonLeafInvoke',
        states: {
          withNonLeafInvoke: {
            invoke: {
              id: 'doNotInvoke',
              src: fromCallback(() => {
                actorStarted = true;
              })
            },
            initial: 'first',
            states: {
              first: {
                always: 'second'
              },
              second: {
                always: '#inactive'
              }
            }
          },
          inactive: {
            id: 'inactive'
          }
        }
      });

      const service = interpret(transientMachine);

      service.start();

      expect(actorStarted).toBe(false);
    });

    it('should invoke a service if other service gets stopped in subsequent microstep (#1180)', (done) => {
      const machine = createMachine({
        initial: 'running',
        states: {
          running: {
            type: 'parallel',
            states: {
              one: {
                initial: 'active',
                on: {
                  STOP_ONE: '.idle'
                },
                states: {
                  idle: {},
                  active: {
                    invoke: {
                      id: 'active',
                      src: fromCallback(() => {
                        /* ... */
                      })
                    },
                    on: {
                      NEXT: {
                        actions: raise({ type: 'STOP_ONE' })
                      }
                    }
                  }
                }
              },
              two: {
                initial: 'idle',
                on: {
                  NEXT: '.active'
                },
                states: {
                  idle: {},
                  active: {
                    invoke: {
                      id: 'post',
                      src: fromPromise(() => Promise.resolve(42)),
                      onDone: '#done'
                    }
                  }
                }
              }
            }
          },
          done: {
            id: 'done',
            type: 'final'
          }
        }
      });

      const service = interpret(machine)
        .onDone(() => done())
        .start();

      service.send({ type: 'NEXT' });
    });

    it('should invoke an actor when reentering invoking state within a single macrostep', () => {
      let actorStartedCount = 0;

      const transientMachine = createMachine<{ counter: number }>({
        initial: 'active',
        context: { counter: 0 },
        states: {
          active: {
            invoke: {
              src: fromCallback(() => {
                actorStartedCount++;
              })
            },
            always: [
              {
                guard: (ctx) => ctx.counter === 0,
                target: 'inactive'
              }
            ]
          },
          inactive: {
            entry: assign({ counter: (ctx) => ++ctx.counter }),
            always: 'active'
          }
        }
      });

      const service = interpret(transientMachine);

      service.start();

      expect(actorStartedCount).toBe(1);
    });
  });

  describe('error handling', () => {
    it('handles escalated errors', (done) => {
      const child = createMachine({
        initial: 'die',

        states: {
          die: {
            entry: [escalate('oops')]
          }
        }
      });

      const parent = createMachine({
        initial: 'one',

        states: {
          one: {
            invoke: {
              id: 'child',
              src: child,
              onError: {
                target: 'two',
                guard: (_, event) => event.data === 'oops'
              }
            }
          },
          two: {
            type: 'final'
          }
        }
      });

      interpret(parent)
        .onDone(() => {
          done();
        })
        .start();
    });

    it('handles escalated errors as an expression', (done) => {
      interface ChildContext {
        id: number;
      }

      const child = createMachine<ChildContext>({
        initial: 'die',
        context: { id: 42 },
        states: {
          die: {
            entry: escalate((ctx) => ctx.id)
          }
        }
      });

      const parent = createMachine({
        initial: 'one',

        states: {
          one: {
            invoke: {
              id: 'child',
              src: child,
              onError: {
                target: 'two',
                guard: (_, event) => {
                  expect(event.data).toEqual(42);
                  return true;
                }
              }
            }
          },
          two: {
            type: 'final'
          }
        }
      });

      interpret(parent)
        .onDone(() => {
          done();
        })
        .start();
    });
  });

  it('invoke `src` can be used with invoke `input`', (done) => {
    const machine = createMachine(
      {
        initial: 'searching',
        states: {
          searching: {
            invoke: {
              src: 'search',
              input: {
                endpoint: 'example.com'
              },
              onDone: 'success'
            }
          },
          success: {
            type: 'final'
          }
        }
      },
      {
        actors: {
          search: fromPromise(async ({ input }) => {
            expect(input.endpoint).toEqual('example.com');

            return await 42;
          })
        }
      }
    );

    interpret(machine)
      .onDone(() => done())
      .start();
  });

  it('invoke `src` can be used with dynamic invoke `input`', async () => {
    const machine = createMachine(
      {
        initial: 'searching',
        context: {
          url: 'example.com'
        },
        states: {
          searching: {
            invoke: {
              src: 'search',
              input: (ctx) => ({ endpoint: ctx.url }),
              onDone: 'success'
            }
          },
          success: {
            type: 'final'
          }
        }
      },
      {
        actors: {
          search: fromPromise(async ({ input }) => {
            expect(input.endpoint).toEqual('example.com');

            return await 42;
          })
        }
      }
    );

    await new Promise<void>((res) =>
      interpret(machine)
        .onDone(() => res())
        .start()
    );
  });

  describe('meta data', () => {
    it('should show meta data', () => {
      const machine = createMachine({
        invoke: {
          src: 'someSource',
          meta: {
            url: 'stately.ai'
          }
        }
      });

      expect(machine.root.invoke[0].meta).toEqual({ url: 'stately.ai' });
    });

    it('meta data should be available in the invoke source function', () => {
      expect.assertions(1);
      const machine = createMachine({
        invoke: {
          src: fromPromise(({ input }) => {
            expect(input).toEqual({ url: 'stately.ai' });
            return Promise.resolve();
          }),
          input: {
            url: 'stately.ai'
          }
        }
      });

      interpret(machine).start();
    });
  });

  it('invoke generated ID should be predictable based on the state node where it is defined', (done) => {
    const machine = createMachine(
      {
        initial: 'a',
        states: {
          a: {
            invoke: {
              src: 'someSrc',
              onDone: {
                guard: (_, e) => {
                  // invoke ID should not be 'someSrc'
                  const expectedType = 'done.invoke.(machine).a:invocation[0]';
                  expect(e.type).toEqual(expectedType);
                  return e.type === expectedType;
                },
                target: 'b'
              }
            }
          },
          b: {
            type: 'final'
          }
        }
      },
      {
        actors: {
          someSrc: fromPromise(() => Promise.resolve())
        }
      }
    );

    interpret(machine)
      .onDone(() => {
        done();
      })
      .start();
  });

  it.each([
    ['src with string reference', { src: 'someSrc' }],
    // ['machine', createMachine({ id: 'someId' })],
    [
      'src containing a machine directly',
      { src: createMachine({ id: 'someId' }) }
    ],
    [
      'src containing a callback actor directly',
      {
        src: fromCallback(() => {
          /* ... */
        })
      }
    ]
  ])(
    'invoke config defined as %s should register unique and predictable child in state',
    (_type, invokeConfig) => {
      const machine = createMachine(
        {
          id: 'machine',
          initial: 'a',
          states: {
            a: {
              invoke: invokeConfig
            }
          }
        },
        {
          actors: {
            someSrc: fromCallback(() => {
              /* ... */
            })
          }
        }
      );

      expect(
        machine.initialState.children['machine.a:invocation[0]']
      ).toBeDefined();
    }
  );

  // https://github.com/statelyai/xstate/issues/464
  it('done.invoke events should only select onDone transition on the invoking state when invokee is referenced using a string', (done) => {
    let counter = 0;
    let invoked = false;

    const createSingleState = (): any => ({
      initial: 'fetch',
      states: {
        fetch: {
          invoke: {
            src: 'fetchSmth',
            onDone: {
              actions: 'handleSuccess'
            }
          }
        }
      }
    });

    const testMachine = createMachine(
      {
        type: 'parallel',
        states: {
          first: createSingleState(),
          second: createSingleState()
        }
      },
      {
        actions: {
          handleSuccess: () => {
            ++counter;
          }
        },
        actors: {
          fetchSmth: fromPromise(() => {
            if (invoked) {
              // create a promise that won't ever resolve for the second invoking state
              return new Promise(() => {
                /* ... */
              });
            }
            invoked = true;
            return Promise.resolve(42);
          })
        }
      }
    );

    interpret(testMachine).start();

    // check within a macrotask so all promise-induced microtasks have a chance to resolve first
    setTimeout(() => {
      expect(counter).toEqual(1);
      done();
    }, 0);
  });

  it('done.invoke events should have unique names when invokee is a machine with an id property', (done) => {
    const actual: string[] = [];

    const childMachine = createMachine({
      id: 'child',
      initial: 'a',
      states: {
        a: {
          invoke: {
            src: fromPromise(() => {
              return Promise.resolve(42);
            }),
            onDone: 'b'
          }
        },
        b: {
          type: 'final'
        }
      }
    });

    const createSingleState = (): any => ({
      initial: 'fetch',
      states: {
        fetch: {
          invoke: {
            src: childMachine
          }
        }
      }
    });

    const testMachine = createMachine({
      type: 'parallel',
      states: {
        first: createSingleState(),
        second: createSingleState()
      },
      on: {
        '*': {
          actions: (_ctx, ev) => {
            actual.push(ev.type);
          }
        }
      }
    });

    interpret(testMachine).start();

    // check within a macrotask so all promise-induced microtasks have a chance to resolve first
    setTimeout(() => {
      expect(actual).toEqual([
        'done.invoke.(machine).first.fetch:invocation[0]',
        'done.invoke.(machine).second.fetch:invocation[0]'
      ]);
      done();
    }, 100);
  });

  it('should get reinstantiated after reentering the invoking state in a microstep', () => {
    let invokeCount = 0;

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          invoke: {
            src: fromCallback(() => {
              invokeCount++;
            })
          },
          on: {
            GO_AWAY_AND_REENTER: 'b'
          }
        },
        b: {
          always: 'a'
        }
      }
    });
    const service = interpret(machine).start();

    service.send({ type: 'GO_AWAY_AND_REENTER' });

    expect(invokeCount).toBe(2);
  });

  it('invocations should be stopped when the machine reaches done state', () => {
    let disposed = false;
    const machine = createMachine({
      initial: 'a',
      invoke: {
        src: fromCallback(() => {
          return () => {
            disposed = true;
          };
        })
      },
      states: {
        a: {
          on: {
            FINISH: 'b'
          }
        },
        b: {
          type: 'final'
        }
      }
    });
    const service = interpret(machine).start();

    service.send({ type: 'FINISH' });
    expect(disposed).toBe(true);
  });

  it('deep invocations should be stopped when the machine reaches done state', () => {
    let disposed = false;
    const childMachine = createMachine({
      invoke: {
        src: fromCallback(() => {
          return () => {
            disposed = true;
          };
        })
      }
    });

    const machine = createMachine({
      initial: 'a',
      invoke: {
        src: childMachine
      },
      states: {
        a: {
          on: {
            FINISH: 'b'
          }
        },
        b: {
          type: 'final'
        }
      }
    });
    const service = interpret(machine).start();

    service.send({ type: 'FINISH' });
    expect(disposed).toBe(true);
  });

  it('root invocations should restart on root external transitions', () => {
    let count = 0;

    const machine = createMachine({
      id: 'root',
      invoke: {
        src: fromPromise(() => {
          count++;
          return Promise.resolve(42);
        })
      },
      on: {
        EVENT: {
          target: '#two',
          external: true
        }
      },
      initial: 'one',
      states: {
        one: {},
        two: {
          id: 'two'
        }
      }
    });

    const service = interpret(machine).start();

    service.send({ type: 'EVENT' });

    expect(count).toEqual(2);
  });
});

describe('actors option', () => {
  it('should provide data params to a service creator', (done) => {
    const machine = createMachine(
      {
        initial: 'pending',
        context: {
          count: 42
        },
        states: {
          pending: {
            invoke: {
              src: 'stringService',
              input: (ctx) => ({
                staticVal: 'hello',
                newCount: ctx.count * 2 // TODO: types
              }),
              onDone: 'success'
            }
          },
          success: {
            type: 'final'
          }
        }
      },
      {
        actors: {
          stringService: fromPromise(({ input }) => {
            expect(input).toEqual({ newCount: 84, staticVal: 'hello' });

            return new Promise<void>((res) => {
              res();
            });
          })
        }
      }
    );

    const service = interpret(machine).onDone(() => {
      done();
    });

    service.start();
  });
});
