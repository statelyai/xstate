import { z } from 'zod';
import {
  AnyEventObject,
  createActor,
  next_createMachine,
  fromCallback,
  fromEventObservable,
  fromObservable,
  fromPromise,
  fromTransition
} from '../src';

describe('event emitter', () => {
  it('only emits expected events if specified in schemas', () => {
    next_createMachine({
      schemas: {
        emitted: z.object({
          type: z.literal('greet'),
          message: z.string()
        })
      },
      entry: (_, enq) => {
        enq.emit({
          // @ts-expect-error
          type: 'nonsense'
        });
      },
      exit: (_, enq) => {
        enq.emit({
          type: 'greet',
          // @ts-expect-error
          message: 1234
        });
      },
      on: {
        someEvent: (_, enq) => {
          enq.emit({
            type: 'greet',
            message: 'hello'
          });
        }
      }
    });
  });

  it('emits any events if not specified in schemas (unsafe)', () => {
    next_createMachine({
      entry: (_, enq) => {
        enq.emit({
          type: 'nonsense'
        });
      },
      exit: (_, enq) => {
        enq.emit({
          type: 'greet',
          // @ts-expect-error
          message: 1234
        });
      },
      on: {
        someEvent: (_, enq) => {
          enq.emit({
            type: 'greet',
            // @ts-expect-error
            message: 'hello'
          });
        }
      }
    });
  });

  it('emits events that can be listened to on actorRef.on(…)', async () => {
    const machine = next_createMachine({
      schemas: {
        emitted: z.object({
          type: z.literal('emitted'),
          foo: z.string()
        })
      },
      on: {
        someEvent: (_, enq) => {
          enq(() => {});
          enq.emit({
            type: 'emitted',
            foo: 'bar'
          });
        }
      }
    });

    const actor = createActor(machine).start();
    setTimeout(() => {
      actor.send({
        type: 'someEvent'
      });
    });
    const event = await new Promise<AnyEventObject>((res) => {
      actor.on('emitted', res);
    });

    expect(event.foo).toBe('bar');
  });

  it('enqueue.emit(…) emits events that can be listened to on actorRef.on(…)', async () => {
    const machine = next_createMachine({
      schemas: {
        emitted: z.object({
          type: z.literal('emitted'),
          foo: z.string()
        })
      },
      on: {
        someEvent: (_, enq) => {
          enq.emit({
            type: 'emitted',
            foo: 'bar'
          });

          enq.emit({
            // @ts-expect-error
            type: 'unknown'
          });
        }
      }
    });

    const actor = createActor(machine).start();
    setTimeout(() => {
      actor.send({
        type: 'someEvent'
      });
    });
    const event = await new Promise<AnyEventObject>((res) => {
      actor.on('emitted', res);
    });

    expect(event.foo).toBe('bar');
  });

  it('handles errors', async () => {
    const machine = next_createMachine({
      schemas: {
        emitted: z.object({
          type: z.literal('emitted'),
          foo: z.string()
        })
      },
      on: {
        someEvent: (_, enq) => {
          enq.emit({
            type: 'emitted',
            foo: 'bar'
          });
        }
      }
    });

    const actor = createActor(machine).start();
    actor.on('emitted', () => {
      throw new Error('oops');
    });
    setTimeout(() => {
      actor.send({
        type: 'someEvent'
      });
    });
    const err = await new Promise((res) =>
      actor.subscribe({
        error: res
      })
    );

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toEqual('oops');
  });

  it('dynamically emits events that can be listened to on actorRef.on(…)', async () => {
    const machine = next_createMachine({
      schemas: {
        context: z.object({
          count: z.number()
        })
      },
      context: { count: 10 },
      on: {
        someEvent: ({ context }, enq) => {
          enq.emit({
            type: 'emitted',
            // @ts-ignore
            count: context.count
          });
        }
      }
    });

    const actor = createActor(machine).start();
    setTimeout(() => {
      actor.send({
        type: 'someEvent'
      });
    });
    const event = await new Promise<AnyEventObject>((res) => {
      actor.on('emitted', res);
    });

    expect(event).toEqual({
      type: 'emitted',
      count: 10
    });
  });

  it('listener should be able to read the updated snapshot of the emitting actor', () => {
    const spy = vi.fn();

    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            ev: (_, enq) => {
              enq.emit({
                type: 'someEvent'
              });

              return {
                target: 'b'
              };
            }
          }
        },
        b: {}
      }
    });

    const actor = createActor(machine);
    actor.on('someEvent', () => {
      spy(actor.getSnapshot().value);
    });

    actor.start();
    actor.send({ type: 'ev' });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('b');
  });

  it('wildcard listeners should be able to receive all emitted events', () => {
    const spy = vi.fn();

    const machine = next_createMachine({
      schemas: {
        emitted: z.union([
          z.object({
            type: z.literal('emitted')
          }),
          z.object({
            type: z.literal('anotherEmitted')
          })
        ])
      },
      on: {
        event: (_, enq) => {
          enq.emit({
            type: 'emitted'
          });
        }
      }
    });

    const actor = createActor(machine);

    actor.on('*', (ev) => {
      ev.type satisfies 'emitted' | 'anotherEmitted';

      // @ts-expect-error
      ev.type satisfies 'whatever';
      spy(ev);
    });

    actor.start();

    actor.send({ type: 'event' });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('events can be emitted from promise logic', () => {
    const spy = vi.fn();

    const logic = fromPromise<any, any, { type: 'emitted'; msg: string }>(
      async ({ emit }) => {
        emit({
          type: 'emitted',
          msg: 'hello'
        });
      }
    );

    const actor = createActor(logic);

    actor.on('emitted', (ev) => {
      ev.type satisfies 'emitted';

      // @ts-expect-error
      ev.type satisfies 'whatever';

      ev satisfies { msg: string };

      spy(ev);
    });

    actor.start();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'emitted',
        msg: 'hello'
      })
    );
  });

  it('events can be emitted from transition logic', () => {
    const spy = vi.fn();

    const logic = fromTransition<
      any,
      any,
      any,
      any,
      { type: 'emitted'; msg: string }
    >((s, e, { emit }) => {
      if (e.type === 'emit') {
        emit({
          type: 'emitted',
          msg: 'hello'
        });
      }
      return s;
    }, {});

    const actor = createActor(logic);

    actor.on('emitted', (ev) => {
      ev.type satisfies 'emitted';

      // @ts-expect-error
      ev.type satisfies 'whatever';

      ev satisfies { msg: string };

      spy(ev);
    });

    actor.start();

    actor.send({ type: 'emit' });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'emitted',
        msg: 'hello'
      })
    );
  });

  it('events can be emitted from observable logic', () => {
    const spy = vi.fn();

    const logic = fromObservable<any, any, { type: 'emitted'; msg: string }>(
      ({ emit }) => {
        emit({
          type: 'emitted',
          msg: 'hello'
        });

        return {
          subscribe: () => {
            return {
              unsubscribe: () => {}
            };
          }
        };
      }
    );

    const actor = createActor(logic);

    actor.on('emitted', (ev) => {
      ev.type satisfies 'emitted';

      // @ts-expect-error
      ev.type satisfies 'whatever';

      ev satisfies { msg: string };

      spy(ev);
    });

    actor.start();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'emitted',
        msg: 'hello'
      })
    );
  });

  it('events can be emitted from event observable logic', () => {
    const spy = vi.fn();

    const logic = fromEventObservable<
      any,
      any,
      { type: 'emitted'; msg: string }
    >(({ emit }) => {
      emit({
        type: 'emitted',
        msg: 'hello'
      });

      return {
        subscribe: () => {
          return {
            unsubscribe: () => {}
          };
        }
      };
    });

    const actor = createActor(logic);

    actor.on('emitted', (ev) => {
      ev.type satisfies 'emitted';

      // @ts-expect-error
      ev.type satisfies 'whatever';

      ev satisfies { msg: string };

      spy(ev);
    });

    actor.start();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'emitted',
        msg: 'hello'
      })
    );
  });

  it('events can be emitted from callback logic', () => {
    const spy = vi.fn();

    const logic = fromCallback<any, any, { type: 'emitted'; msg: string }>(
      ({ emit }) => {
        emit({
          type: 'emitted',
          msg: 'hello'
        });
      }
    );

    const actor = createActor(logic);

    actor.on('emitted', (ev) => {
      ev.type satisfies 'emitted';

      // @ts-expect-error
      ev.type satisfies 'whatever';

      ev satisfies { msg: string };

      spy(ev);
    });

    actor.start();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'emitted',
        msg: 'hello'
      })
    );
  });

  // TODO: event sourcing
  it.skip('events can be emitted from callback logic (restored root)', () => {
    const spy = vi.fn();

    const logic = fromCallback<any, any, { type: 'emitted'; msg: string }>(
      ({ emit }) => {
        emit({
          type: 'emitted',
          msg: 'hello'
        });
      }
    );

    const machine = next_createMachine({
      actors: { logic },
      invoke: {
        id: 'cb',
        src: ({ actors }) => actors.logic
      }
    });

    const actor = createActor(machine);

    // Persist the root actor
    const persistedSnapshot = actor.getPersistedSnapshot();

    // Rehydrate a new instance of the root actor using the persisted snapshot
    const restoredActor = createActor(machine, {
      snapshot: persistedSnapshot
    });

    restoredActor.getSnapshot().children.cb!.on('emitted', (ev) => {
      spy(ev);
    });

    restoredActor.start();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'emitted',
        msg: 'hello'
      })
    );
  });
});
