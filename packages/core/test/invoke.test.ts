import { interval, of } from 'rxjs';
import { map, take } from 'rxjs/operators';
import {
  fromCallback,
  fromEventObservable,
  fromObservable,
  fromPromise,
  fromTransition
} from '../src/actors/index.ts';
import {
  ActorLogic,
  ActorScope,
  EventObject,
  StateValue,
  next_createMachine,
  createActor,
  Snapshot,
  ActorRef,
  AnyEventObject
} from '../src/index.ts';
import { setTimeout as sleep } from 'node:timers/promises';
import z from 'zod';

const user = { name: 'David' };

describe('invoke', () => {
  it('child can immediately respond to the parent with multiple events', () => {
    const childMachine = next_createMachine({
      // types: {} as {
      //   events: { type: 'FORWARD_DEC' };
      // },
      id: 'child',
      initial: 'init',
      states: {
        init: {
          on: {
            FORWARD_DEC: ({ parent }, enq) => {
              enq.sendTo(parent, { type: 'DEC' });
              enq.sendTo(parent, { type: 'DEC' });
              enq.sendTo(parent, { type: 'DEC' });
            }
          }
        }
      }
    });

    const someParentMachine = next_createMachine(
      {
        id: 'parent',
        // types: {} as {
        //   context: { count: number };
        //   actors: {
        //     src: 'child';
        //     id: 'someService';
        //     logic: typeof childMachine;
        //   };
        // },
        schemas: {
          context: z.object({
            count: z.number()
          })
        },
        context: { count: 0 },
        initial: 'start',
        states: {
          start: {
            invoke: {
              src: childMachine,
              id: 'someService'
            },
            always: ({ context }) => {
              if (context.count === -3) {
                return { target: 'stop' };
              }
            },
            on: {
              DEC: ({ context }) => ({
                context: {
                  ...context,
                  count: context.count - 1
                }
              }),
              FORWARD_DEC: ({ children }) => {
                children.someService.send({ type: 'FORWARD_DEC' });
              }
            }
          },
          stop: {
            type: 'final'
          }
        }
      }
      // {
      //   actors: {
      //     child: childMachine
      //   }
      // }
    );

    const actorRef = createActor(someParentMachine).start();
    actorRef.send({ type: 'FORWARD_DEC' });

    // 1. The 'parent' machine will not do anything (inert transition)
    // 2. The 'FORWARD_DEC' event will be "forwarded" to the child machine
    // 3. On the child machine, the 'FORWARD_DEC' event sends the 'DEC' action to the parent thrice
    // 4. The context of the 'parent' machine will be updated from 0 to -3
    expect(actorRef.getSnapshot().context).toEqual({ count: -3 });
  });

  it('should start services (explicit machine, invoke = config)', async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    const childMachine = next_createMachine({
      id: 'fetch',
      // types: {} as {
      //   context: { userId: string | undefined; user?: typeof user | undefined };
      //   events: {
      //     type: 'RESOLVE';
      //     user: typeof user;
      //   };
      //   input: { userId: string };
      // },
      schemas: {
        context: z.object({
          userId: z.string().optional(),
          user: z.object({ name: z.string() }).optional()
        }),
        events: z.object({
          type: z.literal('RESOLVE'),
          user: z.object({ name: z.string() })
        }),
        input: z.object({ userId: z.string() })
      },
      context: ({ input }) => ({
        userId: input.userId
      }),
      initial: 'pending',
      states: {
        pending: {
          entry: (_, enq) => {
            enq.raise({ type: 'RESOLVE', user });
          },
          on: {
            RESOLVE: ({ context }) => {
              if (context.userId !== undefined) {
                return { target: 'success' };
              }
            }
          }
        },
        success: {
          type: 'final',
          entry: ({ context, event }) => ({
            context: {
              ...context,
              user: event.user
            }
          })
        },
        failure: {
          entry: ({ parent }, enq) => {
            enq.sendTo(parent, { type: 'REJECT' });
          }
        }
      },
      output: ({ context }) => ({ user: context.user })
    });

    const machine = next_createMachine({
      // types: {} as {
      //   context: {
      //     selectedUserId: string;
      //     user?: typeof user;
      //   };
      // },
      schemas: {
        context: z.object({
          selectedUserId: z.string(),
          user: z.object({ name: z.string() }).optional()
        })
      },
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
            input: ({ context }: any) => ({
              userId: context.selectedUserId
            }),
            onDone: ({ event }) => {
              // Should receive { user: { name: 'David' } } as event data
              if ((event.output as any).user.name === 'David') {
                return { target: 'received' };
              }
            }
          }
        },
        received: {
          type: 'final'
        }
      }
    });

    const actor = createActor(machine);
    actor.subscribe({
      complete: () => {
        resolve();
      }
    });
    actor.start();
    actor.send({ type: 'GO_TO_WAITING' });
    await promise;
  });

  it('should start services (explicit machine, invoke = machine)', async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    const childMachine = next_createMachine({
      // types: {} as {
      //   events: { type: 'RESOLVE' };
      //   input: { userId: string };
      // },
      schemas: {
        events: z.object({
          type: z.literal('RESOLVE')
        }),
        input: z.object({ userId: z.string() })
      },
      initial: 'pending',
      states: {
        pending: {
          entry: (_, enq) => {
            enq.raise({ type: 'RESOLVE' });
          },
          on: {
            RESOLVE: {
              target: 'success'
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const machine = next_createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            GO_TO_WAITING: 'waiting'
          }
        },
        waiting: {
          invoke: {
            src: childMachine,
            onDone: 'received'
          }
        },
        received: {
          type: 'final'
        }
      }
    });
    const actor = createActor(machine);
    actor.subscribe({
      complete: () => {
        resolve();
      }
    });
    actor.start();
    actor.send({ type: 'GO_TO_WAITING' });
    await promise;
  });

  it('should start services (machine as invoke config)', async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    const machineInvokeMachine = next_createMachine({
      // types: {} as {
      //   events: {
      //     type: 'SUCCESS';
      //     data: number;
      //   };
      // },
      schemas: {
        events: z.object({
          type: z.literal('SUCCESS'),
          data: z.number()
        })
      },
      id: 'machine-invoke',
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: next_createMachine({
              id: 'child',
              initial: 'sending',
              states: {
                sending: {
                  entry: ({ parent }) => {
                    parent?.send({ type: 'SUCCESS', data: 42 });
                  }
                }
              }
            })
          },
          on: {
            SUCCESS: ({ event }) => {
              if (event.data === 42) {
                return { target: 'success' };
              }
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });
    const actor = createActor(machineInvokeMachine);
    actor.subscribe({ complete: () => resolve() });
    actor.start();
    await promise;
  });

  it('should start deeply nested service (machine as invoke config)', async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    const machineInvokeMachine = next_createMachine({
      // types: {} as {
      //   events: {
      //     type: 'SUCCESS';
      //     data: number;
      //   };
      // },
      schemas: {
        events: z.object({
          type: z.literal('SUCCESS'),
          data: z.number()
        })
      },
      id: 'parent',
      initial: 'a',
      states: {
        a: {
          initial: 'b',
          states: {
            b: {
              invoke: {
                src: next_createMachine({
                  id: 'child',
                  initial: 'sending',
                  states: {
                    sending: {
                      entry: ({ parent }) => {
                        parent?.send({ type: 'SUCCESS', data: 42 });
                      }
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
        SUCCESS: ({ event }) => {
          if (event.data === 42) {
            return { target: '.success' };
          }
        }
      }
    });
    const actor = createActor(machineInvokeMachine);
    actor.subscribe({ complete: () => resolve() });
    actor.start();
    await promise;
  });

  it.skip('should use the service overwritten by .provide(...)', async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    const childMachine = next_createMachine({
      id: 'child',
      initial: 'init',
      states: {
        init: {}
      }
    });

    const someParentMachine = next_createMachine({
      id: 'parent',
      context: { count: 0 },
      initial: 'start',
      states: {
        start: {
          invoke: {
            src: childMachine,
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
    });

    const actor = createActor(
      someParentMachine.provide({
        actors: {
          child: next_createMachine({
            id: 'child',
            initial: 'init',
            states: {
              init: {
                entry: ({ parent }) => {
                  parent?.send({ type: 'STOP' });
                }
              }
            }
          })
        }
      })
    );
    actor.subscribe({
      complete: () => {
        resolve();
      }
    });
    actor.start();
    await promise;
  });

  describe('parent to child', () => {
    const subMachine = next_createMachine({
      id: 'child',
      initial: 'one',
      states: {
        one: {
          on: { NEXT: 'two' }
        },
        two: {
          entry: ({ parent }) => {
            parent?.send({ type: 'NEXT' });
          }
        }
      }
    });

    it.skip('should communicate with the child machine (invoke on machine)', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const mainMachine = next_createMachine({
        id: 'parent',
        initial: 'one',
        invoke: {
          id: 'foo-child',
          src: subMachine
        },
        states: {
          one: {
            entry: ({ children }) => {
              // TODO: foo-child is invoked after entry is executed so it does not exist yet
              children.fooChild?.send({ type: 'NEXT' });
            },
            on: { NEXT: 'two' }
          },
          two: {
            type: 'final'
          }
        }
      });

      const actor = createActor(mainMachine);
      actor.subscribe({
        complete: () => {
          resolve();
        }
      });
      actor.start();
      await promise;
    });

    it('should communicate with the child machine (invoke on state)', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const mainMachine = next_createMachine({
        id: 'parent',
        initial: 'one',
        states: {
          one: {
            invoke: {
              id: 'foo-child',
              src: subMachine
            },
            entry: ({ children }) => {
              children['foo-child']?.send({ type: 'NEXT' });
            },
            on: { NEXT: 'two' }
          },
          two: {
            type: 'final'
          }
        }
      });

      const actor = createActor(mainMachine);
      actor.subscribe({
        complete: () => {
          resolve();
        }
      });
      actor.start();
      await promise;
    });

    it('should transition correctly if child invocation causes it to directly go to final state', () => {
      const doneSubMachine = next_createMachine({
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

      const mainMachine = next_createMachine({
        id: 'parent',
        initial: 'one',
        states: {
          one: {
            invoke: {
              id: 'foo-child',
              src: doneSubMachine,
              onDone: 'two'
            },
            entry: ({ children }) => {
              children['foo-child']?.send({ type: 'NEXT' });
            }
          },
          two: {
            on: { NEXT: 'three' }
          },
          three: {
            type: 'final'
          }
        }
      });

      const actor = createActor(mainMachine).start();

      expect(actor.getSnapshot().value).toBe('two');
    });

    it('should work with invocations defined in orthogonal state nodes', async () => {
      const { resolve } = Promise.withResolvers<void>();
      const pongMachine = next_createMachine({
        id: 'pong',
        initial: 'active',
        states: {
          active: {
            type: 'final'
          }
        },
        output: { secret: 'pingpong' }
      });

      const pingMachine = next_createMachine({
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
                  onDone: ({ event }) => {
                    if (event.output.secret === 'pingpong') {
                      return { target: 'success' };
                    }
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

      const actor = createActor(pingMachine);
      actor.subscribe({
        complete: () => {
          resolve();
        }
      });
      actor.start();
    });

    it('should not reinvoke root-level invocations on root non-reentering transitions', () => {
      // https://github.com/statelyai/xstate/issues/2147

      let invokeCount = 0;
      let invokeDisposeCount = 0;
      let actionsCount = 0;
      let entryActionsCount = 0;

      const machine = next_createMachine({
        invoke: {
          src: fromCallback(() => {
            invokeCount++;

            return () => {
              invokeDisposeCount++;
            };
          })
        },
        entry: (_, enq) => {
          enq.action(() => {
            entryActionsCount++;
          });
        },
        on: {
          UPDATE: (_, enq) => {
            enq.action(() => {
              actionsCount++;
            });
          }
        }
      });

      const service = createActor(machine).start();
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
    });

    it('should stop a child actor when reaching a final state', () => {
      let actorStopped = false;

      const machine = next_createMachine({
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

      const service = createActor(machine).start();

      service.send({
        type: 'finished'
      });

      expect(actorStopped).toBe(true);
    });

    it('child should not invoke an actor when it transitions to an invoking state when it gets stopped by its parent', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      let invokeCount = 0;

      const child = next_createMachine({
        id: 'child',
        initial: 'idle',
        states: {
          idle: {
            invoke: {
              src: fromCallback(({ sendBack }) => {
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
              src: fromCallback(({ sendBack }) => {
                sendBack({ type: 'STOPPED' });
              })
            },
            on: {
              STOPPED: ({ parent, event }) => {
                parent?.send(event);
                return { target: 'idle' };
              }
            }
          }
        }
      });
      const parent = next_createMachine({
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

      const service = createActor(parent);
      service.subscribe({
        complete: () => {
          expect(invokeCount).toBe(1);
          resolve();
        }
      });
      service.start();

      service.send({ type: 'START' });
      await promise;
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
      const invokePromiseMachine = next_createMachine({
        schemas: {
          context: z.object({
            id: z.number(),
            succeed: z.boolean()
          })
        },
        id: 'invokePromise',
        initial: 'pending',
        context: ({
          input
        }: {
          input: { id?: number; succeed?: boolean };
        }) => ({
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
              input: ({ context }: any) => context,
              onDone: ({ context, event }) => {
                if (event.output === context.id) {
                  return { target: 'success' };
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

      it('should be invoked with a promise factory and resolve through onDone', async () => {
        const { promise, resolve } = Promise.withResolvers<void>();
        const machine = next_createMachine({
          initial: 'pending',
          states: {
            pending: {
              invoke: {
                src: fromPromise(() =>
                  createPromise((resolve) => {
                    resolve();
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
        const service = createActor(machine);
        service.subscribe({
          complete: () => {
            resolve();
          }
        });
        service.start();
        await promise;
      });

      it('should be invoked with a promise factory and reject with ErrorExecution', async () => {
        const { promise, resolve } = Promise.withResolvers<void>();
        const actor = createActor(invokePromiseMachine, {
          input: { id: 31, succeed: false }
        });
        actor.subscribe({ complete: () => resolve() });
        actor.start();
        await promise;
      });

      it('should be invoked with a promise factory and surface any unhandled errors', async () => {
        const { promise, resolve } = Promise.withResolvers<void>();
        const promiseMachine = next_createMachine({
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

        const service = createActor(promiseMachine);
        service.subscribe({
          error(err) {
            expect((err as any).message).toEqual(expect.stringMatching(/test/));
            resolve();
          }
        });

        service.start();
        await promise;
      });

      it('should be invoked with a promise factory and stop on unhandled onError target', async () => {
        const { promise, resolve } = Promise.withResolvers<void>();
        const completeSpy = vi.fn();

        const promiseMachine = next_createMachine({
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

        const actor = createActor(promiseMachine);

        actor.subscribe({
          error: (err) => {
            expect(err).toBeInstanceOf(Error);
            expect((err as any).message).toBe('test');
            expect(completeSpy).not.toHaveBeenCalled();
            resolve();
          },
          complete: completeSpy
        });
        actor.start();
        await promise;
      });

      it('should be invoked with a promise factory and resolve through onDone for compound state nodes', async () => {
        const { promise, resolve } = Promise.withResolvers<void>();
        const promiseMachine = next_createMachine({
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
        const actor = createActor(promiseMachine);
        actor.subscribe({ complete: () => resolve() });
        actor.start();
        await promise;
      });

      it('should be invoked with a promise service and resolve through onDone for compound state nodes', async () => {
        const { promise, resolve } = Promise.withResolvers<void>();

        const somePromise = fromPromise(() =>
          createPromise((resolve) => resolve())
        );
        const promiseMachine = next_createMachine(
          {
            id: 'promise',
            initial: 'parent',
            states: {
              parent: {
                initial: 'pending',
                states: {
                  pending: {
                    invoke: {
                      src: somePromise,
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
          }
          // {
          //   actors: {
          //     somePromise: fromPromise(() =>
          //       createPromise((resolve) => resolve())
          //     )
          //   }
          // }
        );
        const actor = createActor(promiseMachine);
        actor.subscribe({ complete: () => resolve() });
        actor.start();
        await promise;
      });
      it('should assign the resolved data when invoked with a promise factory', async () => {
        const { promise, resolve } = Promise.withResolvers<void>();
        const promiseMachine = next_createMachine({
          schemas: {
            context: z.object({
              count: z.number()
            })
          },
          id: 'promise',
          context: { count: 0 },
          initial: 'pending',
          states: {
            pending: {
              invoke: {
                src: fromPromise(() =>
                  createPromise((resolve) => resolve({ count: 1 }))
                ),
                onDone: ({ context, event }) => ({
                  context: {
                    ...context,
                    count: event.output.count
                  },
                  target: 'success'
                })
              }
            },
            success: {
              type: 'final'
            }
          }
        });

        const actor = createActor(promiseMachine);
        actor.subscribe({
          complete: () => {
            expect(actor.getSnapshot().context.count).toEqual(1);
            resolve();
          }
        });
        actor.start();
        await promise;
      });

      it('should assign the resolved data when invoked with a promise service', async () => {
        const { promise, resolve } = Promise.withResolvers<void>();
        const somePromise = fromPromise(() =>
          createPromise((resolve) => resolve({ count: 1 }))
        );
        const promiseMachine = next_createMachine(
          {
            schemas: {
              context: z.object({
                count: z.number()
              })
            },
            id: 'promise',
            context: { count: 0 },
            initial: 'pending',
            states: {
              pending: {
                invoke: {
                  src: somePromise,
                  onDone: ({ context, event }) => ({
                    context: {
                      ...context,
                      count: event.output.count
                    },
                    target: 'success'
                  })
                }
              },
              success: {
                type: 'final'
              }
            }
          }
          // {
          //   actors: {
          //     somePromise: fromPromise(() =>
          //       createPromise((resolve) => resolve({ count: 1 }))
          //     )
          //   }
          // }
        );

        const actor = createActor(promiseMachine);
        actor.subscribe({
          complete: () => {
            expect(actor.getSnapshot().context.count).toEqual(1);
            resolve();
          }
        });
        actor.start();
        await promise;
      });

      it('should provide the resolved data when invoked with a promise factory', async () => {
        const { promise, resolve } = Promise.withResolvers<void>();
        let count = 0;

        const promiseMachine = next_createMachine({
          id: 'promise',
          schemas: {
            context: z.object({
              count: z.number()
            })
          },
          context: { count: 0 },
          initial: 'pending',
          states: {
            pending: {
              invoke: {
                src: fromPromise(() =>
                  createPromise((resolve) => resolve({ count: 1 }))
                ),
                onDone: ({ context, event }) => {
                  count = (event.output as any).count;
                  return {
                    context: {
                      ...context,
                      count: (event.output as any).count
                    },
                    target: 'success'
                  };
                }
              }
            },
            success: {
              type: 'final'
            }
          }
        });

        const actor = createActor(promiseMachine);
        actor.subscribe({
          complete: () => {
            expect(count).toEqual(1);
            resolve();
          }
        });
        actor.start();
        await promise;
      });

      it('should provide the resolved data when invoked with a promise service', async () => {
        const { promise, resolve } = Promise.withResolvers<void>();
        let count = 0;
        const somePromise = fromPromise(() =>
          createPromise((resolve) => resolve({ count: 1 }))
        );

        const promiseMachine = next_createMachine(
          {
            id: 'promise',
            initial: 'pending',
            states: {
              pending: {
                invoke: {
                  src: somePromise,
                  onDone: ({ event }, enq) => {
                    enq.action(() => {
                      count = event.output.count;
                    });
                    return {
                      target: 'success'
                    };
                  }
                }
              },
              success: {
                type: 'final'
              }
            }
          }
          // {
          //   actors: {
          //     somePromise: fromPromise(() =>
          //       createPromise((resolve) => resolve({ count: 1 }))
          //     )
          //   }
          // }
        );

        const actor = createActor(promiseMachine);
        actor.subscribe({
          complete: () => {
            expect(count).toEqual(1);
            resolve();
          }
        });
        actor.start();
        await promise;
      });

      it('should be able to specify a Promise as a service', async () => {
        const { promise, resolve } = Promise.withResolvers<void>();

        const promiseActor = fromPromise(
          ({ input }: { input: { foo: boolean; event: { payload: any } } }) => {
            return createPromise((resolve, reject) => {
              input.foo && input.event.payload ? resolve() : reject();
            });
          }
        );

        const promiseMachine = next_createMachine(
          {
            id: 'promise',
            schemas: {
              context: z.object({
                foo: z.boolean()
              }),
              events: z.object({
                type: z.literal('BEGIN'),
                payload: z.any()
              })
            },
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
                  src: promiseActor,
                  input: ({ context, event }) => ({
                    foo: context.foo,
                    event: event
                  }),
                  onDone: 'last'
                }
              },
              last: {
                type: 'final'
              }
            }
          }
          // {
          //   actors: {
          //     somePromise: promiseActor
          //   }
          // }
        );

        const actor = createActor(promiseMachine);
        actor.subscribe({ complete: () => resolve() });
        actor.start();
        actor.send({
          type: 'BEGIN',
          payload: true
        });
        await promise;
      });

      it('should be able to reuse the same promise logic multiple times and create unique promise for each created actor', async () => {
        const { promise, resolve } = Promise.withResolvers<void>();
        const getRandomNumber = fromPromise(() =>
          createPromise((resolve) => resolve({ result: Math.random() }))
        );
        const machine = next_createMachine(
          {
            // types: {} as {
            //   context: {
            //     result1: number | null;
            //     result2: number | null;
            //   };
            //   actors: {
            //     src: 'getRandomNumber';
            //     logic: PromiseActorLogic<{ result: number }>;
            //   };
            // },
            schemas: {
              context: z.object({
                result1: z.number().nullable(),
                result2: z.number().nullable()
              })
            },
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
                          src: getRandomNumber,
                          onDone: ({ context, event }) => {
                            // TODO: we get DoneInvokeEvent<any> here, this gets fixed with https://github.com/microsoft/TypeScript/pull/48838
                            return {
                              context: {
                                ...context,
                                result1: event.output.result
                              },
                              target: 'success'
                            };
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
                          src: getRandomNumber,
                          onDone: ({ context, event }) => ({
                            context: {
                              ...context,
                              result2: (event.output as any).result
                            },
                            target: 'success'
                          })
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
          }
          // {
          //   actors: {
          //     // it's important for this actor to be reused, this test shouldn't use a factory or anything like that
          //     getRandomNumber: fromPromise(() => {
          //       return createPromise((resolve) =>
          //         resolve({ result: Math.random() })
          //       );
          //     })
          //   }
          // }
        );

        const service = createActor(machine);
        service.subscribe({
          complete: () => {
            const snapshot = service.getSnapshot();
            expect(typeof snapshot.context.result1).toBe('number');
            expect(typeof snapshot.context.result2).toBe('number');
            expect(snapshot.context.result1).not.toBe(snapshot.context.result2);
            resolve();
          }
        });
        service.start();
        await promise;
      });

      it('should not emit onSnapshot if stopped', async () => {
        const { promise, resolve } = Promise.withResolvers<void>();
        const machine = next_createMachine({
          initial: 'active',
          states: {
            active: {
              invoke: {
                src: fromPromise(() =>
                  createPromise((res) => {
                    setTimeout(() => res(42), 5);
                  })
                ),
                onSnapshot: {}
              },
              on: {
                deactivate: 'inactive'
              }
            },
            inactive: {
              on: {
                '*': ({ event }) => {
                  if ((event as any).snapshot) {
                    throw new Error(`Received unexpected event: ${event.type}`);
                  }
                }
              }
            }
          }
        });

        const actor = createActor(machine).start();
        actor.send({ type: 'deactivate' });

        setTimeout(() => {
          resolve();
        }, 10);
        await promise;
      });
    });
  });

  describe('with callbacks', () => {
    it('should be able to specify a callback as a service', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      interface BeginEvent {
        type: 'BEGIN';
        payload: boolean;
      }
      interface CallbackEvent {
        type: 'CALLBACK';
        data: number;
      }

      const someCallback = fromCallback(
        ({
          sendBack,
          input
        }: {
          sendBack: (event: BeginEvent | CallbackEvent) => void;
          input: { foo: boolean; event: BeginEvent | CallbackEvent };
        }) => {
          if (input.foo && input.event.type === 'BEGIN') {
            sendBack({
              type: 'CALLBACK',
              data: 40
            });
            sendBack({
              type: 'CALLBACK',
              data: 41
            });
            sendBack({
              type: 'CALLBACK',
              data: 42
            });
          }
        }
      );

      const callbackMachine = next_createMachine(
        {
          id: 'callback',
          // types: {} as {
          //   context: { foo: boolean };
          //   events: BeginEvent | CallbackEvent;
          //   actors: {
          //     src: 'someCallback';
          //     logic: typeof someCallback;
          //   };
          // },
          schemas: {
            context: z.object({
              foo: z.boolean()
            }),
            events: z.union([
              z.object({
                type: z.literal('BEGIN'),
                payload: z.any()
              }),
              z.object({
                type: z.literal('CALLBACK'),
                data: z.number()
              })
            ])
          },
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
                src: someCallback,
                input: ({ context, event }: any) => ({
                  foo: context.foo,
                  event: event
                })
              },
              on: {
                CALLBACK: ({ event }) => {
                  if (event.data === 42) {
                    return { target: 'last' };
                  }
                }
              }
            },
            last: {
              type: 'final'
            }
          }
        }
        // {
        //   actors: {
        //     someCallback
        //   }
        // }
      );

      const actor = createActor(callbackMachine);
      actor.subscribe({ complete: () => resolve() });
      actor.start();
      actor.send({
        type: 'BEGIN',
        payload: true
      });
      await promise;
    });

    it('should transition correctly if callback function sends an event', () => {
      const someCallback = fromCallback(({ sendBack }) => {
        sendBack({ type: 'CALLBACK' });
      });
      const callbackMachine = next_createMachine(
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
                src: someCallback
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
        }
        // {
        //   actors: {
        //     someCallback: fromCallback(({ sendBack }) => {
        //       sendBack({ type: 'CALLBACK' });
        //     })
        //   }
        // }
      );

      const expectedStateValues = ['pending', 'first', 'intermediate'];
      const stateValues: StateValue[] = [];
      const actor = createActor(callbackMachine);
      actor.subscribe((current) => stateValues.push(current.value));
      actor.start().send({ type: 'BEGIN' });
      for (let i = 0; i < expectedStateValues.length; i++) {
        expect(stateValues[i]).toEqual(expectedStateValues[i]);
      }
    });

    it('should transition correctly if callback function invoked from start and sends an event', () => {
      const someCallback = fromCallback(({ sendBack }) => {
        sendBack({ type: 'CALLBACK' });
      });
      const callbackMachine = next_createMachine(
        {
          id: 'callback',
          initial: 'idle',
          context: { foo: true },
          states: {
            idle: {
              invoke: {
                src: someCallback
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
        }
        // {
        //   actors: {
        //     someCallback: fromCallback(({ sendBack }) => {
        //       sendBack({ type: 'CALLBACK' });
        //     })
        //   }
        // }
      );

      const expectedStateValues = ['idle', 'intermediate'];
      const stateValues: StateValue[] = [];
      const actor = createActor(callbackMachine);
      actor.subscribe((current) => stateValues.push(current.value));
      actor.start().send({ type: 'BEGIN' });
      for (let i = 0; i < expectedStateValues.length; i++) {
        expect(stateValues[i]).toEqual(expectedStateValues[i]);
      }
    });

    // tslint:disable-next-line:max-line-length
    it('should transition correctly if transient transition happens before current state invokes callback function and sends an event', () => {
      const someCallback = fromCallback(({ sendBack }) => {
        sendBack({ type: 'CALLBACK' });
      });
      const callbackMachine = next_createMachine(
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
                src: someCallback
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
        }
        // {
        //   actors: {
        //     someCallback: fromCallback(({ sendBack }) => {
        //       sendBack({ type: 'CALLBACK' });
        //     })
        //   }
        // }
      );

      const expectedStateValues = ['pending', 'second', 'third'];
      const stateValues: StateValue[] = [];
      const actor = createActor(callbackMachine);
      actor.subscribe((current) => {
        stateValues.push(current.value);
      });
      actor.start().send({ type: 'BEGIN' });

      for (let i = 0; i < expectedStateValues.length; i++) {
        expect(stateValues[i]).toEqual(expectedStateValues[i]);
      }
    });

    it('should treat a callback source as an event stream', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const intervalMachine = next_createMachine({
        // types: {} as { context: { count: number } },
        schemas: {
          context: z.object({
            count: z.number()
          })
        },
        id: 'interval',
        initial: 'counting',
        context: {
          count: 0
        },
        states: {
          counting: {
            invoke: {
              id: 'intervalService',
              src: fromCallback(({ sendBack }) => {
                const ivl = setInterval(() => {
                  sendBack({ type: 'INC' });
                }, 10);

                return () => clearInterval(ivl);
              })
            },
            always: ({ context }) => {
              if (context.count === 3) {
                return { target: 'finished' };
              }
            },
            on: {
              INC: ({ context }) => ({
                context: {
                  count: context.count + 1
                }
              })
            }
          },
          finished: {
            type: 'final'
          }
        }
      });
      const actor = createActor(intervalMachine);
      actor.subscribe({ complete: () => resolve() });
      actor.start();
      await promise;
    });

    it('should dispose of the callback (if disposal function provided)', () => {
      const spy = vi.fn();
      const intervalMachine = next_createMachine({
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
      const actorRef = createActor(intervalMachine).start();

      actorRef.send({ type: 'NEXT' });

      expect(spy).toHaveBeenCalled();
    });

    it('callback should be able to receive messages from parent', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const pingPongMachine = next_createMachine({
        id: 'ping-pong',
        initial: 'active',
        states: {
          active: {
            invoke: {
              id: 'child',
              src: fromCallback(({ sendBack, receive }) => {
                receive((e) => {
                  if (e.type === 'PING') {
                    sendBack({ type: 'PONG' });
                  }
                });
              })
            },
            entry: ({ children }) => {
              children['child']?.send({ type: 'PING' });
            },
            on: {
              PONG: 'done'
            }
          },
          done: {
            type: 'final'
          }
        }
      });
      const actor = createActor(pingPongMachine);
      actor.subscribe({ complete: () => resolve() });
      actor.start();
      await promise;
    });

    it('should call onError upon error (sync)', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const errorMachine = next_createMachine({
        id: 'error',
        initial: 'safe',
        states: {
          safe: {
            invoke: {
              src: fromCallback(() => {
                throw new Error('test');
              }),
              onError: ({ event }) => {
                if (
                  event.error instanceof Error &&
                  event.error.message === 'test'
                ) {
                  return { target: 'failed' };
                }
              }
            }
          },
          failed: {
            type: 'final'
          }
        }
      });
      const actor = createActor(errorMachine);
      actor.subscribe({ complete: () => resolve() });
      actor.start();
      await promise;
    });

    it('should transition correctly upon error (sync)', () => {
      const errorMachine = next_createMachine({
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
      const service = createActor(errorMachine).start();
      expect(service.getSnapshot().value).toEqual(expectedStateValue);
    });

    it('should call onError only on the state which has invoked failed service', () => {
      const errorMachine = next_createMachine({
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
                initial: 'waiting',
                states: {
                  waiting: {
                    invoke: {
                      src: fromCallback(() => {
                        throw new Error('test');
                      }),
                      onError: {
                        target: 'failed'
                      }
                    }
                  },
                  failed: {}
                }
              },
              second: {
                initial: 'waiting',
                states: {
                  waiting: {
                    invoke: {
                      src: fromCallback(() => {
                        // empty
                        return () => {};
                      }),
                      onError: {
                        target: 'failed'
                      }
                    }
                  },
                  failed: {}
                }
              }
            }
          }
        }
      });

      const actorRef = createActor(errorMachine).start();
      actorRef.send({ type: 'FETCH' });

      expect(actorRef.getSnapshot().value).toEqual({
        fetch: { first: 'failed', second: 'waiting' }
      });
    });

    it('should be able to be stringified', () => {
      const machine = next_createMachine({
        initial: 'idle',
        states: {
          idle: {
            on: {
              GO_TO_WAITING: 'waiting'
            }
          },
          waiting: {
            invoke: {
              src: fromCallback(() => {})
            }
          }
        }
      });
      const actorRef = createActor(machine).start();
      actorRef.send({ type: 'GO_TO_WAITING' });
      const waitingState = actorRef.getSnapshot();

      expect(() => {
        JSON.stringify(waitingState);
      }).not.toThrow();
    });

    it('should result in an error notification if callback actor throws when it starts and the error stays unhandled by the machine', () => {
      const errorMachine = next_createMachine({
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
      const spy = vi.fn();

      const actorRef = createActor(errorMachine);
      actorRef.subscribe({
        error: spy
      });
      actorRef.start();
      expect(spy.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [Error: test],
          ],
        ]
      `);
    });

    it('should work with input', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const machine = next_createMachine({
        // types: {} as {
        //   context: { foo: string };
        // },
        schemas: {
          context: z.object({
            foo: z.string()
          })
        },
        initial: 'start',
        context: { foo: 'bar' },
        states: {
          start: {
            invoke: {
              src: fromCallback(({ input }) => {
                expect(input).toEqual({ foo: 'bar' });
                resolve();
              }),
              input: ({ context }: any) => context
            }
          }
        }
      });

      createActor(machine).start();
      await promise;
    });

    it('sub invoke race condition ends on the completed state', () => {
      const anotherChildMachine = next_createMachine({
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

      const anotherParentMachine = next_createMachine({
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
              STOPCHILD: ({ children }) => {
                children['invoked.child'].send({ type: 'STOP' });
              }
            }
          },
          completed: {
            type: 'final'
          }
        }
      });

      const actorRef = createActor(anotherParentMachine).start();
      actorRef.send({ type: 'STOPCHILD' });

      expect(actorRef.getSnapshot().value).toEqual('completed');
    });
  });

  describe('with observables', () => {
    it('should work with an infinite observable', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const obsMachine = next_createMachine({
        // types: {} as { context: { count: number | undefined }; events: Events },
        schemas: {
          context: z.object({
            count: z.number().optional()
          })
        },
        id: 'infiniteObs',
        initial: 'counting',
        context: { count: undefined },
        states: {
          counting: {
            invoke: {
              src: fromObservable(() => interval(10)),
              onSnapshot: ({ event }) => ({
                context: {
                  count: event.snapshot.context
                }
              })
            },
            always: ({ context }) => {
              if (context.count === 5) {
                return { target: 'counted' };
              }
            }
          },
          counted: {
            type: 'final'
          }
        }
      });

      const service = createActor(obsMachine);
      service.subscribe({
        complete: () => {
          resolve();
        }
      });
      service.start();
      await promise;
    });

    it('should work with a finite observable', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const obsMachine = next_createMachine({
        // types: {} as { context: Ctx; events: Events },
        schemas: {
          context: z.object({
            count: z.number().optional()
          })
        },
        id: 'obs',
        initial: 'counting',
        context: {
          count: undefined
        },
        states: {
          counting: {
            invoke: {
              src: fromObservable(() => interval(10).pipe(take(5))),
              onSnapshot: ({ event }) => ({
                context: {
                  count: event.snapshot.context
                }
              }),
              onDone: ({ context }) => {
                if (context.count === 4) {
                  return { target: 'counted' };
                }
              }
            }
          },
          counted: {
            type: 'final'
          }
        }
      });

      const actor = createActor(obsMachine);
      actor.subscribe({
        complete: () => {
          resolve();
        }
      });
      actor.start();
      await promise;
    });

    it('should receive an emitted error', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const obsMachine = next_createMachine({
        // types: {} as { context: Ctx; events: Events },
        schemas: {
          context: z.object({
            count: z.number().optional()
          })
        },
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
              onSnapshot: ({ event }) => ({
                context: {
                  count: event.snapshot.context
                }
              }),
              onError: ({ context, event }) => {
                expect((event.error as any).message).toEqual('some error');
                if (
                  context.count === 4 &&
                  (event.error as any).message === 'some error'
                ) {
                  return { target: 'success' };
                }
              }
            }
          },
          success: {
            type: 'final'
          }
        }
      });

      const actor = createActor(obsMachine);
      actor.subscribe({
        complete: () => {
          resolve();
        }
      });
      actor.start();
      await promise;
    });

    it('should work with input', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const childLogic = fromObservable(({ input }: { input: number }) =>
        of(input)
      );

      const machine = next_createMachine(
        {
          // types: {} as {
          //   actors: {
          //     src: 'childLogic';
          //     logic: typeof childLogic;
          //   };
          // },
          schemas: {},
          context: { received: undefined },
          invoke: {
            src: childLogic,
            input: 42,
            onSnapshot: ({ event }, enq) => {
              if (
                event.snapshot.status === 'active' &&
                event.snapshot.context === 42
              ) {
                enq.action(() => {
                  resolve();
                });
              }
            }
          }
        }
        // {
        //   actors: {
        //     childLogic
        //   }
        // }
      );

      createActor(machine).start();
      await promise;
    });
  });

  describe('with event observables', () => {
    it('should work with an infinite event observable', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const obsMachine = next_createMachine({
        // types: {} as { context: { count: number | undefined }; events: Events },
        schemas: {
          context: z.object({
            count: z.number().optional()
          }),
          events: z.object({
            type: z.literal('COUNT'),
            value: z.number()
          })
        },
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
              COUNT: ({ context, event }) => ({
                context: {
                  ...context,
                  count: event.value
                }
              })
            },
            always: ({ context }) => {
              if (context.count === 5) {
                return { target: 'counted' };
              }
            }
          },
          counted: {
            type: 'final'
          }
        }
      });

      const service = createActor(obsMachine);
      service.subscribe({
        complete: () => {
          resolve();
        }
      });
      service.start();
      await promise;
    });

    it('should work with a finite event observable', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const obsMachine = next_createMachine({
        // types: {} as { context: Ctx; events: Events },
        schemas: {
          context: z.object({
            count: z.number().optional()
          }),
          events: z.object({
            type: z.literal('COUNT'),
            value: z.number()
          })
        },
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
              onDone: ({ context }) => {
                if (context.count === 4) {
                  return { target: 'counted' };
                }
              }
            },
            on: {
              COUNT: ({ context, event }) => ({
                context: {
                  ...context,
                  count: event.value
                }
              })
            }
          },
          counted: {
            type: 'final'
          }
        }
      });

      const actor = createActor(obsMachine);
      actor.subscribe({
        complete: () => {
          resolve();
        }
      });
      actor.start();
      await promise;
    });

    it('should receive an emitted error', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const obsMachine = next_createMachine({
        // types: {} as { context: Ctx; events: Events },
        schemas: {
          context: z.object({
            count: z.number().optional()
          }),
          events: z.object({
            type: z.literal('COUNT'),
            value: z.number()
          })
        },
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
              onError: ({ context, event }) => {
                expect((event.error as any).message).toEqual('some error');
                if (
                  context.count === 4 &&
                  (event.error as any).message === 'some error'
                ) {
                  return { target: 'success' };
                }
              }
            },
            on: {
              COUNT: ({ context, event }) => ({
                context: {
                  ...context,
                  count: event.value
                }
              })
            }
          },
          success: {
            type: 'final'
          }
        }
      });

      const actor = createActor(obsMachine);
      actor.subscribe({
        complete: () => {
          resolve();
        }
      });
      actor.start();
      await promise;
    });

    it('should work with input', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const machine = next_createMachine({
        schemas: {
          events: z.object({
            type: z.literal('obs.event'),
            value: z.number()
          })
        },
        invoke: {
          src: fromEventObservable(({ input }) =>
            of({
              type: 'obs.event',
              value: input
            })
          ),
          input: 42
        },
        on: {
          'obs.event': ({ event }, enq) => {
            expect(event.value).toEqual(42);
            enq.action(() => {
              resolve();
            });
          }
        }
      });

      createActor(machine).start();
      await promise;
    });
  });

  describe('with logic', () => {
    it('should work with actor logic', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const countLogic: ActorLogic<
        Snapshot<undefined> & { context: number },
        EventObject
      > = {
        transition: (state, event) => {
          if (event.type === 'INC') {
            return {
              ...state,
              context: state.context + 1
            };
          } else if (event.type === 'DEC') {
            return {
              ...state,
              context: state.context - 1
            };
          }
          return state;
        },
        getInitialSnapshot: () => ({
          status: 'active',
          output: undefined,
          error: undefined,
          context: 0
        }),
        getPersistedSnapshot: (s) => s
      };

      const countMachine = next_createMachine({
        invoke: {
          id: 'count',
          src: countLogic
        },
        on: {
          INC: ({ children, event }) => {
            children['count'].send(event);
          }
        }
      });

      const countService = createActor(countMachine);
      countService.subscribe((state) => {
        if (state.children['count']?.getSnapshot().context === 2) {
          resolve();
        }
      });
      countService.start();

      countService.send({ type: 'INC' });
      countService.send({ type: 'INC' });
      await promise;
    });

    it('logic should have reference to the parent', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
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

      const pingMachine = next_createMachine({
        initial: 'waiting',
        states: {
          waiting: {
            entry: ({ children }) => {
              children['ponger']?.send({ type: 'PING' });
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

      const pingService = createActor(pingMachine);
      pingService.subscribe({
        complete: () => {
          resolve();
        }
      });
      pingService.start();
      await promise;
    });
  });

  describe('with transition functions', () => {
    it('should work with a transition function', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
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

      const countMachine = next_createMachine({
        invoke: {
          id: 'count',
          src: fromTransition(countReducer, 0)
        },
        on: {
          INC: ({ children, event }) => {
            children['count'].send(event);
          }
        }
      });

      const countService = createActor(countMachine);
      countService.subscribe((state) => {
        if (state.children['count']?.getSnapshot().context === 2) {
          resolve();
        }
      });
      countService.start();

      countService.send({ type: 'INC' });
      countService.send({ type: 'INC' });
      await promise;
    });

    it('should schedule events in a FIFO queue', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      type CountEvents = { type: 'INC' } | { type: 'DOUBLE' };

      const countReducer = (
        count: number,
        event: CountEvents,
        { self }: ActorScope<any, CountEvents>
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

      const countMachine = next_createMachine({
        invoke: {
          id: 'count',
          src: fromTransition(countReducer, 0)
        },
        on: {
          INC: ({ children, event }) => {
            children['count'].send(event);
          }
        }
      });

      const countService = createActor(countMachine);
      countService.subscribe((state) => {
        if (state.children['count']?.getSnapshot().context === 2) {
          resolve();
        }
      });
      countService.start();

      countService.send({ type: 'INC' });
      await promise;
    });

    it('should emit onSnapshot', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const doublerLogic = fromTransition(
        (_, event: { type: 'update'; value: number }) => event.value * 2,
        0
      );
      const machine = next_createMachine({
        invoke: {
          id: 'doubler',
          src: doublerLogic,
          onSnapshot: ({ event }, enq) => {
            if (event.snapshot.context === 42) {
              enq.action(() => {
                resolve();
              });
            }
          }
        },
        entry: ({ children }) => {
          children['doubler']?.send({ type: 'update', value: 21 });
        }
      });

      createActor(machine).start();
      await promise;
    });
  });

  describe('with machines', () => {
    const pongMachine = next_createMachine({
      id: 'pong',
      initial: 'active',
      states: {
        active: {
          on: {
            PING: ({ parent }) => {
              // Sends 'PONG' event to parent machine
              parent?.send({ type: 'PONG' });
            }
          }
        }
      }
    });

    // Parent machine
    const pingMachine = next_createMachine({
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
              entry: ({ children }) => {
                children['pong']?.send({ type: 'PING' });
              },
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

    it('should create invocations from machines in nested states', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const actor = createActor(pingMachine);
      actor.subscribe({ complete: () => resolve() });
      actor.start();
      await promise;
    });

    it('should emit onSnapshot', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const childMachine = next_createMachine({
        initial: 'a',
        states: {
          a: {
            after: {
              10: 'b'
            }
          },
          b: {}
        }
      });
      const machine = next_createMachine({
        invoke: {
          src: childMachine,
          onSnapshot: ({ event }, enq) => {
            if (event.snapshot.value === 'b') {
              enq.action(() => {
                resolve();
              });
            }
          }
        }
      });

      createActor(machine).start();
      await promise;
    });
  });

  describe('multiple simultaneous services', () => {
    const multiple = next_createMachine({
      schemas: {
        context: z.object({
          one: z.string().optional(),
          two: z.string().optional()
        })
      },
      id: 'machine',
      initial: 'one',
      context: {},
      on: {
        ONE: ({ context }) => ({
          context: {
            ...context,
            one: 'one'
          }
        }),

        TWO: ({ context }) => ({
          context: {
            ...context,
            two: 'two'
          },
          target: '.three'
        })
      },

      states: {
        one: {
          initial: 'two',
          states: {
            two: {
              invoke: [
                {
                  id: 'child',
                  src: fromCallback(({ sendBack }) => sendBack({ type: 'ONE' }))
                },
                {
                  id: 'child2',
                  src: fromCallback(({ sendBack }) => sendBack({ type: 'TWO' }))
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

    it('should start all services at once', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const service = createActor(multiple);
      service.subscribe({
        complete: () => {
          expect(service.getSnapshot().context).toEqual({
            one: 'one',
            two: 'two'
          });
          resolve();
        }
      });

      service.start();
      await promise;
    });

    const parallel = next_createMachine({
      schemas: {
        context: z.object({
          one: z.string().optional(),
          two: z.string().optional()
        })
      },
      id: 'machine',
      initial: 'one',

      context: {},

      on: {
        ONE: ({ context }) => ({
          context: {
            ...context,
            one: 'one'
          }
        }),

        TWO: ({ context }) => ({
          context: {
            ...context,
            two: 'two'
          }
        })
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
                    src: fromCallback(({ sendBack }) =>
                      sendBack({ type: 'ONE' })
                    )
                  }
                },
                b: {
                  invoke: {
                    id: 'child2',
                    src: fromCallback(({ sendBack }) =>
                      sendBack({ type: 'TWO' })
                    )
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

    it('should run services in parallel', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const service = createActor(parallel);
      service.subscribe({
        complete: () => {
          expect(service.getSnapshot().context).toEqual({
            one: 'one',
            two: 'two'
          });
          resolve();
        }
      });

      service.start();
      await promise;
    });

    it('should not invoke an actor if it gets stopped immediately by transitioning away in immediate microstep', () => {
      // Since an actor will be canceled when the state machine leaves the invoking state
      // it does not make sense to start an actor in a state that will be exited immediately
      let actorStarted = false;

      const transientMachine = next_createMachine({
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

      const service = createActor(transientMachine);

      service.start();

      expect(actorStarted).toBe(false);
    });

    // tslint:disable-next-line: max-line-length
    it('should not invoke an actor if it gets stopped immediately by transitioning away in subsequent microstep', () => {
      // Since an actor will be canceled when the state machine leaves the invoking state
      // it does not make sense to start an actor in a state that will be exited immediately
      let actorStarted = false;

      const transientMachine = next_createMachine({
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

      const service = createActor(transientMachine);

      service.start();

      expect(actorStarted).toBe(false);
    });

    it('should invoke a service if other service gets stopped in subsequent microstep (#1180)', async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const machine = next_createMachine({
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
                      NEXT: (_, enq) => {
                        enq.raise({ type: 'STOP_ONE' });
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

      const service = createActor(machine);
      service.subscribe({ complete: () => resolve() });
      service.start();

      service.send({ type: 'NEXT' });
      await promise;
    });

    it('should invoke an actor when reentering invoking state within a single macrostep', () => {
      let actorStartedCount = 0;

      const transientMachine = next_createMachine({
        // types: {} as { context: { counter: number } },
        schemas: {
          context: z.object({
            counter: z.number()
          })
        },
        initial: 'active',
        context: { counter: 0 },
        states: {
          active: {
            invoke: {
              src: fromCallback(() => {
                actorStartedCount++;
              })
            },
            always: ({ context }) => {
              if (context.counter === 0) {
                return { target: 'inactive' };
              }
            }
          },
          inactive: {
            entry: ({ context }) => ({
              context: {
                ...context,
                counter: context.counter + 1
              }
            }),
            always: 'active'
          }
        }
      });

      const service = createActor(transientMachine);

      service.start();

      expect(actorStartedCount).toBe(1);
    });
  });

  it('invoke `src` can be used with invoke `input`', async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    const machine = next_createMachine({
      initial: 'searching',
      states: {
        searching: {
          invoke: {
            src: fromPromise(async ({ input }) => {
              expect(input.endpoint).toEqual('example.com');

              return 42;
            }),
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
    });
    const actor = createActor(machine);
    actor.subscribe({ complete: () => resolve() });
    actor.start();
    await promise;
  });

  it('invoke `src` can be used with dynamic invoke `input`', async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    const machine = next_createMachine({
      initial: 'searching',
      context: {
        url: 'example.com'
      },
      states: {
        searching: {
          invoke: {
            src: fromPromise(async ({ input }) => {
              expect(input.endpoint).toEqual('example.com');

              return 42;
            }),
            input: ({ context }) => ({ endpoint: context.url }),
            onDone: 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const actor = createActor(machine);
    actor.subscribe({ complete: () => resolve() });
    actor.start();
    await promise;
  });

  it('invoke generated ID should be predictable based on the state node where it is defined', async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          invoke: {
            src: fromPromise(() => Promise.resolve()),
            onDone: ({ event }) => {
              // invoke ID should not be 'someSrc'
              const expectedType = 'xstate.done.actor.0.(machine).a';
              expect(event.type).toEqual(expectedType);
              if (event.type === expectedType) {
                return { target: 'b' };
              }
            }
          }
        },
        b: {
          type: 'final'
        }
      }
    });

    const actor = createActor(machine);
    actor.subscribe({
      complete: () => {
        resolve();
      }
    });
    actor.start();
    await promise;
  });

  it.each([
    // ['src with string reference', { src: 'someSrc' }],
    // ['machine', next_createMachine({ id: 'someId' })],
    [
      'src containing a machine directly',
      { src: next_createMachine({ id: 'someId' }) }
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
      const machine = next_createMachine(
        {
          id: 'machine',
          initial: 'a',
          states: {
            a: {
              invoke: invokeConfig
            }
          }
        }
        // {
        //   actors: {
        //     someSrc: fromCallback(() => {
        //       /* ... */
        //     })
        //   }
        // }
      );

      expect(
        createActor(machine).getSnapshot().children['0.machine.a']
      ).toBeDefined();
    }
  );

  // https://github.com/statelyai/xstate/issues/464
  it('xstate.done.actor events should only select onDone transition on the invoking state when invokee is referenced using a string', async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    let counter = 0;
    let invoked = false;

    const handleSuccess = () => {
      ++counter;
    };

    const createSingleState = (): any => ({
      initial: 'fetch',
      states: {
        fetch: {
          invoke: {
            src: fromPromise(() => {
              if (invoked) {
                // create a promise that won't ever resolve for the second invoking state
                return new Promise(() => {
                  /* ... */
                });
              }
              invoked = true;
              return Promise.resolve(42);
            }),
            onDone: (_, enq) => {
              enq.action(handleSuccess);
            }
          }
        }
      }
    });

    const testMachine = next_createMachine({
      type: 'parallel',
      states: {
        first: createSingleState(),
        second: createSingleState()
      }
    });

    createActor(testMachine).start();

    // check within a macrotask so all promise-induced microtasks have a chance to resolve first
    setTimeout(() => {
      expect(counter).toEqual(1);
      resolve();
    }, 0);
    await promise;
  });

  it('xstate.done.actor events should have unique names when invokee is a machine with an id property', async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    const actual: AnyEventObject[] = [];

    const childMachine = next_createMachine({
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

    const testMachine = next_createMachine({
      type: 'parallel',
      states: {
        first: createSingleState(),
        second: createSingleState()
      },
      on: {
        '*': ({ event }, enq) => {
          enq.action(() => {
            actual.push(event);
          });
        }
      }
    });

    createActor(testMachine).start();

    // check within a macrotask so all promise-induced microtasks have a chance to resolve first
    setTimeout(() => {
      expect(actual).toEqual([
        {
          type: 'xstate.done.actor.0.(machine).first.fetch',
          output: undefined,
          actorId: '0.(machine).first.fetch'
        },
        {
          type: 'xstate.done.actor.0.(machine).second.fetch',
          output: undefined,
          actorId: '0.(machine).second.fetch'
        }
      ]);
      resolve();
    }, 100);
    await promise;
  });

  it('should get reinstantiated after reentering the invoking state in a microstep', () => {
    let invokeCount = 0;

    const machine = next_createMachine({
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
    const service = createActor(machine).start();

    service.send({ type: 'GO_AWAY_AND_REENTER' });

    expect(invokeCount).toBe(2);
  });

  it('invocations should be stopped when the machine reaches done state', () => {
    let disposed = false;
    const machine = next_createMachine({
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
    const service = createActor(machine).start();

    service.send({ type: 'FINISH' });
    expect(disposed).toBe(true);
  });

  it('deep invocations should be stopped when the machine reaches done state', () => {
    let disposed = false;
    const childMachine = next_createMachine({
      invoke: {
        src: fromCallback(() => {
          return () => {
            disposed = true;
          };
        })
      }
    });

    const machine = next_createMachine({
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
    const service = createActor(machine).start();

    service.send({ type: 'FINISH' });
    expect(disposed).toBe(true);
  });

  it('root invocations should restart on root reentering transitions', () => {
    let count = 0;

    const machine = next_createMachine({
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
          reenter: true
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

    const service = createActor(machine).start();

    service.send({ type: 'EVENT' });

    expect(count).toEqual(2);
  });

  it('should be able to restart an invoke when reentering the invoking state', () => {
    const actual: string[] = [];
    let invokeCounter = 0;

    const machine = next_createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: { ACTIVATE: 'active' }
        },
        active: {
          invoke: {
            src: fromCallback(() => {
              const localId = ++invokeCounter;
              actual.push(`start ${localId}`);
              return () => {
                actual.push(`stop ${localId}`);
              };
            })
          },
          on: {
            REENTER: {
              target: 'active',
              reenter: true
            }
          }
        }
      }
    });

    const service = createActor(machine).start();

    service.send({
      type: 'ACTIVATE'
    });

    actual.length = 0;

    service.send({
      type: 'REENTER'
    });

    expect(actual).toEqual(['stop 1', 'start 2']);
  });

  it.skip('should be able to receive a delayed event sent by the entry action of the invoking state', async () => {
    const child = next_createMachine({
      types: {} as {
        events: {
          type: 'PING';
          origin: ActorRef<Snapshot<unknown>, { type: 'PONG' }>;
        };
      },
      on: {
        PING: ({ event }) => {
          event.origin.send({ type: 'PONG' });
        }
      }
    });
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          invoke: {
            id: 'foo',
            src: child
          },
          entry: ({ children, self }, enq) => {
            // TODO: invoke gets called after entry so children.foo does not exist yet
            enq.sendTo(
              children.foo,
              { type: 'PING', origin: self },
              { delay: 1 }
            );
          },
          on: {
            PONG: 'c'
          }
        },
        c: {
          type: 'final'
        }
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'NEXT' });
    await sleep(3);
    expect(actorRef.getSnapshot().status).toBe('done');
  });
});

describe('invoke input', () => {
  it('should provide input to an actor creator', async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    const machine = next_createMachine({
      initial: 'pending',
      context: {
        count: 42
      },
      states: {
        pending: {
          invoke: {
            src: fromPromise(({ input }) => {
              expect(input).toEqual({ newCount: 84, staticVal: 'hello' });

              return Promise.resolve(true);
            }),
            input: ({ context }) => ({
              staticVal: 'hello',
              newCount: context.count * 2
            }),
            onDone: 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const service = createActor(machine);
    service.subscribe({
      complete: () => {
        resolve();
      }
    });

    service.start();
    await promise;
  });

  it('should provide self to input mapper', async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    const machine = next_createMachine({
      invoke: {
        src: fromCallback(({ input }) => {
          expect(input.responder.send).toBeDefined();
          resolve();
        }),
        input: ({ self }) => ({
          responder: self
        })
      }
    });

    createActor(machine).start();
    await promise;
  });
});
