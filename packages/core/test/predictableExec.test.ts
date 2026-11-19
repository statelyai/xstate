import { createMachine, createActor, waitFor } from '../src/index.ts';
import { createCallbackLogic } from '../src/actors/index.ts';
import { createAsyncLogic } from '../src/actors/index.ts';
import { z } from 'zod';

describe('predictableExec', () => {
  it('should call mixed custom and builtin actions in the definitions order', () => {
    const actual: string[] = [];

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: { target: 'b' } }
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
    const machine = createMachine({
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
    const machine = createMachine({
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
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: { target: 'b' }
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
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: { target: 'b' }
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
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: { target: 'b' }
          }
        },
        b: {
          on: {
            RAISED: { target: 'c' }
          },
          entry: (_, enq) => {
            enq.raise({ type: 'RAISED' });
          }
        },
        c: {
          invoke: {
            src: createCallbackLogic(({ input }) => {
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
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: { target: 'b' }
          }
        },
        b: {
          invoke: {
            id: 'myChild',
            src: createCallbackLogic(() => {})
          }
        }
      }
    });

    const service = createActor(machine).start();
    service.send({ type: 'NEXT' });

    expect(service.getSnapshot().children.myChild).toBeDefined();
  });

  it('invoked child should not be available on the state after leaving invoking state', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: { target: 'b' }
          }
        },
        b: {
          invoke: {
            id: 'myChild',
            src: createCallbackLogic(() => {})
          },
          on: {
            NEXT: { target: 'c' }
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
    const machine = createMachine({
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
            NEXT: { target: 'b' }
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

    const machine = createMachine({
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
    const child = createMachine({
      initial: 'a',
      states: {
        a: {
          // we need to clear the call stack before we send the event to the parent
          after: {
            1: { target: 'b' }
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

    const machine = createMachine({
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
    const child = createMachine({
      on: {
        PING: ({ parent }) => {
          parent?.send({ type: 'PONG' });
        }
      }
    });

    const machine = createMachine({
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
            PONG: { target: 'done' }
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

  it.each(['initial', 'transition'])(
    'should create invoke with the entry context patch on %s entry',
    (mode) => {
      const received: unknown[] = [];
      const child = createCallbackLogic(({ input }) => {
        received.push(input);
      });
      const machine = createMachine({
        context: { consent: 'unset' },
        initial: mode === 'initial' ? 'b' : 'a',
        states: {
          a: { on: { NEXT: { target: 'b' } } },
          b: {
            entry: () => ({ context: { consent: 'patched' } }),
            invoke: {
              src: child,
              input: ({ context }) => ({ consent: context.consent })
            }
          }
        }
      });
      const actor = createActor(machine).start();
      if (mode === 'transition') {
        actor.send({ type: 'NEXT' });
      }
      expect(received).toEqual([{ consent: 'patched' }]);
      actor.stop();
    }
  );

  it.each(['initial', 'transition'])(
    'should retain invoke refs, queued sends and startup listeners with an entry patch on %s entry',
    (mode) => {
      const received: string[] = [];
      const child = createCallbackLogic<
        { type: string },
        string,
        { type: 'ready'; consent: string }
      >(({ input, emit, receive }) => {
        emit({ type: 'ready', consent: input });
        receive(({ type }) => received.push(type));
      });
      let entryRef;
      let directEmission: unknown;
      const machine = createMachine({
        schemas: {
          events: {
            NEXT: z.object({}),
            READY: z.object({ consent: z.string() }),
            SNAPSHOT: z.object({})
          }
        },
        context: { consent: 'unset', heard: '', subscribed: false },
        initial: mode === 'initial' ? 'b' : 'a',
        states: {
          a: { on: { NEXT: { target: 'b' } } },
          b: {
            entry: ({ children }, enq) => {
              entryRef = children.worker;
              children.worker!.on('ready', (event) => {
                directEmission = event;
              });
              children.worker!.send({ type: 'direct' });
              enq.sendTo(children.worker!, { type: 'queued' });
              enq.listen(
                children.worker!,
                'ready',
                (event: { type: 'ready'; consent: string }) => ({
                  type: 'READY',
                  consent: event.consent
                })
              );
              enq.subscribeTo(children.worker!, {
                snapshot: () => ({ type: 'SNAPSHOT' })
              });
              return { context: { consent: 'patched' } };
            },
            invoke: {
              id: 'worker',
              src: child,
              input: ({ context }) => context.consent
            },
            on: {
              READY: ({ event }) => ({ context: { heard: event.consent } }),
              SNAPSHOT: () => ({ context: { subscribed: true } })
            }
          }
        }
      });
      const actor = createActor(machine).start();
      if (mode === 'transition') {
        actor.send({ type: 'NEXT' });
      }
      expect(entryRef).toBe(actor.getSnapshot().children.worker);
      expect(received).toEqual(['direct', 'queued']);
      expect(directEmission).toEqual({ type: 'ready', consent: 'patched' });
      expect(actor.getSnapshot().context).toEqual({
        consent: 'patched',
        heard: 'patched',
        subscribed: true
      });
      actor.stop();
    }
  );

  it.each(['entry', 'input'])(
    'should release reserved invoke registry keys when %s throws',
    (phase) => {
      const failure = new Error('failed');
      const childStarted = vi.fn();
      const machine = createMachine({
        initial: 'a',
        onError: { target: '.failed' },
        states: {
          a: { on: { NEXT: { target: 'b' } } },
          b: {
            entry: () => {
              if (phase === 'entry') {
                throw failure;
              }
            },
            invoke: {
              src: createCallbackLogic(childStarted),
              registryKey: 'worker',
              input: () => {
                throw failure;
              }
            }
          },
          failed: {}
        }
      });
      const actor = createActor(machine).start();
      actor.send({ type: 'NEXT' });
      expect(actor.getSnapshot().value).toBe('failed');
      expect(actor.system.get('worker')).toBeUndefined();
      expect(childStarted).not.toHaveBeenCalled();
      actor.stop();
    }
  );

  it.each(['entry', 'input'])(
    'should release actors spawned during entry when %s throws and allow retry',
    (phase) => {
      const started = vi.fn();
      const caught = vi.fn();
      const failure = new Error('expected failure');
      const leaf = createCallbackLogic(started);
      const spawned = createMachine({
        invoke: { src: leaf, registryKey: 'nested' }
      });
      const machine = createMachine({
        context: { retry: false },
        initial: 'b',
        onError: ({ event }) => {
          caught(event.error);
          return { target: '.failed' };
        },
        states: {
          b: {
            entry: ({ context }, enq) => {
              enq.spawn(spawned, { registryKey: 'spawned' });
              if (phase === 'entry' && !context.retry) {
                throw failure;
              }
            },
            invoke: {
              id: 'worker',
              src: leaf,
              input: ({ context }) => {
                if (!context.retry) {
                  throw failure;
                }
              }
            }
          },
          failed: {
            entry: () => ({ context: { retry: true } }),
            on: { RETRY: { target: 'b' } }
          }
        }
      });
      const actor = createActor(machine).start();
      expect(actor.getSnapshot().value).toBe('failed');
      expect(caught).toHaveBeenCalledExactlyOnceWith(failure);
      expect(actor.system.get('spawned')).toBeUndefined();
      expect(actor.system.get('nested')).toBeUndefined();
      expect(started).not.toHaveBeenCalled();

      actor.send({ type: 'RETRY' });
      expect(actor.getSnapshot().value).toBe('b');
      expect(actor.getSnapshot().status).toBe('active');
      expect(actor.system.get('spawned')).toBeDefined();
      expect(actor.system.get('nested')).toBeDefined();
      expect(started).toHaveBeenCalledTimes(2);
      actor.stop();
    }
  );

  it('should reuse an aborted invoke id during immediate error recovery', () => {
    const started = vi.fn();
    const errors = vi.fn();
    const machine = createMachine({
      context: { retry: false },
      initial: 'b',
      onError: () => ({ target: '.b', context: { retry: true } }),
      states: {
        b: {
          invoke: {
            id: 'worker',
            src: createCallbackLogic(started),
            input: ({ context }) => {
              if (!context.retry) throw new Error('input failed');
            }
          }
        }
      }
    });
    const actor = createActor(machine);
    actor.subscribe({ error: errors });
    actor.start();
    expect(errors).not.toHaveBeenCalled();
    expect(actor.getSnapshot().status).toBe('active');
    expect(actor.getSnapshot().children.worker).toBeDefined();
    expect(started).toHaveBeenCalledOnce();
    actor.stop();
  });

  it('should keep existing actors when entry allocations are discarded', () => {
    const started = vi.fn();
    const child = createCallbackLogic(started);
    const machine = createMachine({
      invoke: { src: child, registryKey: 'existing' },
      initial: 'idle',
      onError: { target: '.failed' },
      states: {
        idle: { on: { NEXT: { target: 'b' } } },
        b: {
          entry: (_, enq) => {
            enq.spawn(child, { registryKey: 'new' });
            throw new Error('entry failed');
          }
        },
        failed: {}
      }
    });
    const actor = createActor(machine).start();
    const existing = actor.system.get('existing');
    actor.send({ type: 'NEXT' });
    expect(actor.getSnapshot().value).toBe('failed');
    expect(actor.system.get('existing')).toBe(existing);
    expect(existing!.getSnapshot().status).toBe('active');
    expect(actor.system.get('new')).toBeUndefined();
    expect(started).toHaveBeenCalledOnce();
    actor.stop();
  });

  it('should deliver events sent from the entry actions to a service invoked in the same state', () => {
    let received: any;

    const machine = createMachine({
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
            NEXT: { target: 'b' }
          }
        },
        b: {
          entry: ({ children }) => {
            children.myChild?.send({ type: 'KNOCK_KNOCK' });
          },
          invoke: {
            id: 'myChild',
            src: createMachine({
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
    const child = createMachine({
      initial: 'a',
      states: {
        a: {
          // we need to clear the call stack before we send the event to the parent
          after: {
            1: { target: 'b' }
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

    const machine = createMachine({
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
    const child = createMachine({
      on: {
        PING: ({ parent }) => {
          parent?.send({ type: 'PONG' });
        }
      }
    });

    const machine = createMachine({
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
            PONG: { target: 'done' }
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
  it('should deliver events sent from the exit actions to a service invoked in the same state', () => {
    const received = vi.fn();
    const machine = createMachine({
      initial: 'active',
      states: {
        active: {
          invoke: {
            id: 'my-service',
            src: createCallbackLogic(({ receive }) => {
              receive(received);
            })
          },
          exit: ({ children }, enq) => {
            enq.sendTo(children['my-service'], { type: 'MY_EVENT' });
          },
          on: {
            TOGGLE: { target: 'inactive' }
          }
        },
        inactive: {}
      }
    });

    const actor = createActor(machine).start();

    actor.send({ type: 'TOGGLE' });

    expect(received).toHaveBeenCalledWith({ type: 'MY_EVENT' });
  });
});
