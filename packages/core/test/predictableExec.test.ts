import { next_createMachine, createActor, waitFor } from '../src/index.ts';
import { fromCallback } from '../src/actors/index.ts';
import { fromPromise } from '../src/actors/index.ts';
import { z } from 'zod';

describe('predictableExec', () => {
  it('should call mixed custom and builtin actions in the definitions order', () => {
    const actual: string[] = [];

    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: 'b' }
        },
        b: {
          entry: (_, enq) => {
            enq(() => actual.push('custom'));
            enq(() => actual.push('assign'));
          }
        }
      }
    });

    const service = createActor(machine).start();
    service.send({ type: 'NEXT' });

    expect(actual).toEqual(['custom', 'assign']);
  });

  it('should call initial custom actions when starting a service', () => {
    let called = false;
    const machine = next_createMachine({
      entry: (_, enq) => {
        enq(() => {
          called = true;
        });
      }
    });

    expect(called).toBe(false);

    createActor(machine).start();

    expect(called).toBe(true);
  });

  it('should resolve initial assign actions before starting a service', () => {
    const machine = next_createMachine({
      schemas: {
        context: z.object({
          called: z.boolean()
        })
      },
      context: {
        called: false
      },
      entry: () => ({
        context: {
          called: true
        }
      })
    });

    expect(createActor(machine).getSnapshot().context.called).toBe(true);
  });

  it('should call raised transition custom actions with raised event', () => {
    let eventArg: any;
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          on: {
            RAISED: ({ event }, enq) => {
              enq(() => (eventArg = event));
              return { target: 'c' };
            }
          },
          entry: (_, enq) => {
            enq.raise({ type: 'RAISED' });
          }
        },
        c: {}
      }
    });

    const service = createActor(machine).start();
    service.send({ type: 'NEXT' });

    expect(eventArg.type).toBe('RAISED');
  });

  it('should call raised transition builtin actions with raised event', () => {
    let eventArg: any;
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          on: {
            RAISED: ({ event }, enq) => {
              enq(() => (eventArg = event));
              return { target: 'c' };
            }
          },
          entry: (_, enq) => {
            enq.raise({ type: 'RAISED' });
          }
        },
        c: {}
      }
    });

    const service = createActor(machine).start();
    service.send({ type: 'NEXT' });

    expect(eventArg.type).toBe('RAISED');
  });

  it('should call invoke creator with raised event', () => {
    let eventArg: any;
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          on: {
            RAISED: 'c'
          },
          entry: (_, enq) => {
            enq.raise({ type: 'RAISED' });
          }
        },
        c: {
          invoke: {
            src: fromCallback(({ input }) => {
              eventArg = input.event;
            }),
            input: ({ event }: any) => ({ event })
          }
        }
      }
    });

    const service = createActor(machine).start();
    service.send({ type: 'NEXT' });

    expect(eventArg.type).toBe('RAISED');
  });

  it('invoked child should be available on the new state', () => {
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
            id: 'myChild',
            src: fromCallback(() => {})
          }
        }
      }
    });

    const service = createActor(machine).start();
    service.send({ type: 'NEXT' });

    expect(service.getSnapshot().children.myChild).toBeDefined();
  });

  it('invoked child should not be available on the state after leaving invoking state', () => {
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
            id: 'myChild',
            src: fromCallback(() => {})
          },
          on: {
            NEXT: 'c'
          }
        },
        c: {}
      }
    });

    const service = createActor(machine).start();
    service.send({ type: 'NEXT' });
    service.send({ type: 'NEXT' });

    expect(service.getSnapshot().children.myChild).not.toBeDefined();
  });

  it('should correctly provide intermediate context value to a custom action executed in between assign actions', () => {
    let calledWith = 0;
    const machine = next_createMachine({
      schemas: {
        context: z.object({
          counter: z.number()
        })
      },
      context: {
        counter: 0
      },
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          entry: (_, enq) => {
            const context1 = { counter: 1 };
            enq(() => {
              calledWith = context1.counter;
            });
            return {
              context: {
                counter: 2
              }
            };
          }
        }
      }
    });

    const service = createActor(machine).start();
    service.send({ type: 'NEXT' });

    expect(calledWith).toBe(1);
  });

  it('initial actions should receive context updated only by preceding assign actions', () => {
    const actual: number[] = [];

    const machine = next_createMachine({
      schemas: {
        context: z.object({
          count: z.number()
        })
      },
      context: { count: 0 },
      entry: ({ context }, enq) => {
        const count0 = context.count;
        enq(() => actual.push(count0));
        const count1 = count0 + 1;
        enq(() => actual.push(count1));
        const count2 = count1 + 1;
        enq(() => actual.push(count2));
        return {
          context: {
            count: count2
          }
        };
      }
    });

    createActor(machine).start();

    expect(actual).toEqual([0, 1, 2]);
  });

  it('parent should be able to read the updated state of a child when receiving an event from it', async () => {
    const child = next_createMachine({
      initial: 'a',
      states: {
        a: {
          // we need to clear the call stack before we send the event to the parent
          after: {
            1: 'b'
          }
        },
        b: {
          // entry: sendParent({ type: 'CHILD_UPDATED' })
          entry: ({ parent }, enq) => {
            enq.sendTo(parent, { type: 'CHILD_UPDATED' });
          }
        }
      }
    });

    const machine = next_createMachine({
      invoke: {
        id: 'myChild',
        src: child
      },
      initial: 'initial',
      states: {
        initial: {
          on: {
            CHILD_UPDATED: ({ children }) => {
              if (children.myChild?.getSnapshot().value === 'b') {
                return { target: 'success' };
              }
              return { target: 'fail' };
            }
          }
        },
        success: {
          type: 'final'
        },
        fail: {
          type: 'final'
        }
      }
    });

    const service = createActor(machine);

    await new Promise<void>((resolve) => {
      service.subscribe({
        complete: () => {
          expect(service.getSnapshot().value).toBe('success');
          resolve();
        }
      });
      service.start();
    });
  });

  it('should be possible to send immediate events to initially invoked actors', () => {
    const child = next_createMachine({
      on: {
        PING: ({ parent }) => {
          parent?.send({ type: 'PONG' });
        }
      }
    });

    const machine = next_createMachine({
      initial: 'waiting',
      states: {
        waiting: {
          invoke: {
            id: 'ponger',
            src: child
          },
          entry: ({ children }) => {
            children.ponger?.send({ type: 'PING' });
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

    const service = createActor(machine).start();

    expect(service.getSnapshot().value).toBe('done');
  });

  it.skip('should create invoke based on context updated by entry actions of the same state', async () => {
    const machine = next_createMachine({
      schemas: {
        context: z.object({
          updated: z.boolean()
        })
      },
      context: {
        updated: false
      },
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          entry: () => ({
            context: {
              updated: true
            }
          }),
          invoke: {
            src: fromPromise(({ input }) => {
              expect(input.updated).toBe(true);
              return Promise.resolve();
            }),
            input: ({ context }: any) => ({
              updated: context.updated
            })
          }
        }
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'NEXT' });
  });

  it('should deliver events sent from the entry actions to a service invoked in the same state', () => {
    let received: any;

    const machine = next_createMachine({
      schemas: {
        context: z.object({
          updated: z.boolean()
        })
      },
      context: {
        updated: false
      },
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          entry: ({ children }) => {
            children.myChild?.send({ type: 'KNOCK_KNOCK' });
          },
          invoke: {
            id: 'myChild',
            src: next_createMachine({
              on: {
                // '*': {
                //   actions: ({ event }: any) => {
                //     received = event;
                //   }
                // }
                '*': ({ event }, enq) => {
                  enq(() => (received = event));
                }
              }
            })
          }
        }
      }
    });

    const service = createActor(machine).start();
    service.send({ type: 'NEXT' });

    expect(received).toEqual({ type: 'KNOCK_KNOCK' });
  });

  it('parent should be able to read the updated state of a child when receiving an event from it', async () => {
    const child = next_createMachine({
      initial: 'a',
      states: {
        a: {
          // we need to clear the call stack before we send the event to the parent
          after: {
            1: 'b'
          }
        },
        b: {
          entry: ({ parent }, enq) => {
            // TODO: this should be deferred
            enq(() => {
              setTimeout(() => {
                parent?.send({ type: 'CHILD_UPDATED' });
              }, 1);
            });
          }
        }
      }
    });

    const machine = next_createMachine({
      invoke: {
        id: 'myChild',
        src: child
      },
      initial: 'initial',
      states: {
        initial: {
          on: {
            CHILD_UPDATED: ({ children }) => {
              if (children.myChild?.getSnapshot().value === 'b') {
                return { target: 'success' };
              }
              return { target: 'fail' };
            }
          }
        },
        success: {
          type: 'final'
        },
        fail: {
          type: 'final'
        }
      }
    });

    const service = createActor(machine);

    await new Promise<void>((resolve) => {
      service.subscribe({
        complete: () => {
          expect(service.getSnapshot().value).toBe('success');
          resolve();
        }
      });
      service.start();
    });
  });

  it('should be possible to send immediate events to initially invoked actors', async () => {
    const child = next_createMachine({
      on: {
        PING: ({ parent }) => {
          parent?.send({ type: 'PONG' });
        }
      }
    });

    const machine = next_createMachine({
      initial: 'waiting',
      states: {
        waiting: {
          invoke: {
            id: 'ponger',
            src: child
          },
          entry: ({ children }) => {
            // TODO: this should be deferred
            setTimeout(() => {
              children.ponger?.send({ type: 'PING' });
            }, 1);
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

    const service = createActor(machine).start();

    await waitFor(service, (state) => state.matches('done'));
  });

  // https://github.com/statelyai/xstate/issues/3617
  it('should deliver events sent from the exit actions to a service invoked in the same state', async () => {
    const machine = next_createMachine({
      initial: 'active',
      states: {
        active: {
          invoke: {
            id: 'my-service',
            src: fromCallback(({ receive }) => {
              receive((event) => {
                if (event.type === 'MY_EVENT') {
                  // Event received successfully
                }
              });
            })
          },
          exit: ({ children }, enq) => {
            enq.sendTo(children['my-service'], { type: 'MY_EVENT' });
          },
          on: {
            TOGGLE: 'inactive'
          }
        },
        inactive: {}
      }
    });

    const actor = createActor(machine).start();

    // Wait a bit to ensure the event is processed
    await new Promise((resolve) => setTimeout(resolve, 10));

    actor.send({ type: 'TOGGLE' });

    // Wait a bit more to ensure the exit action completes
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
});
