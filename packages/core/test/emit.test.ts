import {
  AnyEventObject,
  createActor,
  createMachine,
  enqueueActions,
  fromCallback,
  fromEventObservable,
  fromObservable,
  fromPromise,
  fromTransition,
  setup
} from '../src';
import { emit } from '../src/actions/emit';

describe('event emitter', () => {
  it('only emits expected events if specified in setup', () => {
    setup({
      types: {
        emitted: {} as { type: 'greet'; message: string }
      }
    }).createMachine({
      // @ts-expect-error
      entry: emit({ type: 'nonsense' }),
      // @ts-expect-error
      exit: emit({ type: 'greet', message: 1234 }),

      on: {
        someEvent: {
          actions: emit({ type: 'greet', message: 'hello' })
        }
      }
    });
  });

  it('emits any events if not specified in setup (unsafe)', () => {
    createMachine({
      entry: emit({ type: 'nonsense' }),
      exit: emit({ type: 'greet', message: 1234 }),
      on: {
        someEvent: {
          actions: emit({ type: 'greet', message: 'hello' })
        }
      }
    });
  });

  it('emits events that can be listened to on actorRef.on(…)', async () => {
    const machine = setup({
      types: {
        emitted: {} as { type: 'emitted'; foo: string }
      }
    }).createMachine({
      on: {
        someEvent: {
          actions: emit({ type: 'emitted', foo: 'bar' })
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
    const machine = setup({
      types: {
        emitted: {} as { type: 'emitted'; foo: string }
      }
    }).createMachine({
      on: {
        someEvent: {
          actions: enqueueActions(({ enqueue }) => {
            enqueue.emit({ type: 'emitted', foo: 'bar' });

            enqueue.emit({
              // @ts-expect-error
              type: 'unknown'
            });
          })
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
    const machine = setup({
      types: {
        emitted: {} as { type: 'emitted'; foo: string }
      }
    }).createMachine({
      on: {
        someEvent: {
          actions: emit({ type: 'emitted', foo: 'bar' })
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
    const machine = createMachine({
      context: { count: 10 },
      on: {
        someEvent: {
          actions: emit(({ context }) => ({
            type: 'emitted',
            count: context.count
          }))
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
    const spy = jest.fn();

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            ev: {
              actions: emit({ type: 'someEvent' }),
              target: 'b'
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
    const spy = jest.fn();

    const machine = setup({
      types: {
        events: {} as { type: 'event' },
        emitted: {} as { type: 'emitted' } | { type: 'anotherEmitted' }
      }
    }).createMachine({
      on: {
        event: {
          actions: emit({ type: 'emitted' })
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
    const spy = jest.fn();

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
    const spy = jest.fn();

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
    const spy = jest.fn();

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
    const spy = jest.fn();

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
    const spy = jest.fn();

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

  it('events can be emitted from callback logic (restored root)', () => {
    const spy = jest.fn();

    const logic = fromCallback<any, any, { type: 'emitted'; msg: string }>(
      ({ emit }) => {
        emit({
          type: 'emitted',
          msg: 'hello'
        });
      }
    );

    const machine = setup({
      actors: { logic }
    }).createMachine({
      invoke: {
        id: 'cb',
        src: 'logic'
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
