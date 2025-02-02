import { produce } from 'immer';
import { createStore, createStoreWithProducer } from '../src/index.ts';
import { createBrowserInspector } from '@statelyai/inspect';

it('updates a store with an event without mutating original context', () => {
  const context = { count: 0 };
  const store = createStore({
    context,
    on: {
      inc: (context, event: { by: number }) => {
        return {
          count: context.count + event.by
        };
      }
    }
  });

  const initial = store.getInitialSnapshot();

  store.send({ type: 'inc', by: 1 });

  const next = store.getSnapshot();

  expect(initial.context).toEqual({ count: 0 });
  expect(next.context).toEqual({ count: 1 });
  expect(context.count).toEqual(0);
});

it('can update context with a property assigner', () => {
  const store = createStore({
    context: { count: 0, greeting: 'hello' },
    on: {
      inc: (ctx) => ({
        ...ctx,
        count: ctx.count + 1
      }),
      updateBoth: (ctx) => ({
        count: 42,
        greeting: 'hi'
      })
    }
  });

  store.send({
    type: 'inc'
  });
  expect(store.getSnapshot().context).toEqual({ count: 1, greeting: 'hello' });

  store.send({
    type: 'updateBoth'
  });
  expect(store.getSnapshot().context).toEqual({ count: 42, greeting: 'hi' });
});

it('handles unknown events (does not do anything)', () => {
  const store = createStore({
    context: { count: 0 },
    on: {
      inc: (ctx) => ({
        count: ctx.count + 1
      })
    }
  });

  store.send({
    // @ts-expect-error
    type: 'unknown'
  });
  expect(store.getSnapshot().context).toEqual({ count: 0 });
});

it('updates state from sent events', () => {
  const store = createStore({
    context: {
      count: 0
    },
    on: {
      inc: (ctx, ev: { by: number }) => {
        return {
          count: ctx.count + ev.by
        };
      },
      dec: (ctx, ev: { by: number }) => {
        return {
          count: ctx.count - ev.by
        };
      },
      clear: () => {
        return {
          count: 0
        };
      }
    }
  });

  store.send({ type: 'inc', by: 9 });
  store.send({ type: 'dec', by: 3 });

  expect(store.getSnapshot().context).toEqual({ count: 6 });
  store.send({ type: 'clear' });

  expect(store.getSnapshot().context).toEqual({ count: 0 });
});

it('createStoreWithProducer(…) works with an immer producer', () => {
  const store = createStoreWithProducer(produce, {
    context: {
      count: 0
    },
    on: {
      inc: (ctx, ev: { by: number }) => {
        ctx.count += ev.by;
      }
    }
  });

  store.send({ type: 'inc', by: 3 });
  store.send({
    // @ts-expect-error
    type: 'whatever'
  });

  expect(store.getSnapshot().context).toEqual({ count: 3 });
  expect(store.getInitialSnapshot().context).toEqual({ count: 0 });
});

it('createStoreWithProducer(…) works with an immer producer (object API)', () => {
  const store = createStoreWithProducer(produce, {
    context: {
      count: 0
    },
    on: {
      inc: (ctx, ev: { by: number }) => {
        ctx.count += ev.by;
      }
    }
  });

  store.send({ type: 'inc', by: 3 });
  store.send({
    // @ts-expect-error
    type: 'whatever'
  });

  expect(store.getSnapshot().context).toEqual({ count: 3 });
  expect(store.getInitialSnapshot().context).toEqual({ count: 0 });
});

it('createStoreWithProducer(…) infers the context type properly with a producer', () => {
  const store = createStoreWithProducer(produce, {
    context: {
      count: 0
    },
    on: {
      inc: (ctx, ev: { by: number }) => {
        ctx.count += ev.by;
      }
    }
  });

  store.getSnapshot().context satisfies { count: number };
});

it('createStoreWithProducer(…) infers the context type properly with a producer (object API)', () => {
  const store = createStoreWithProducer(produce, {
    context: {
      count: 0
    },
    on: {
      inc: (ctx, ev: { by: number }) => {
        ctx.count += ev.by;
      }
    }
  });

  store.getSnapshot().context satisfies { count: number };
});

it('can be observed', () => {
  const store = createStore({
    context: {
      count: 0
    },
    on: {
      inc: (ctx) => ({
        count: ctx.count + 1
      })
    }
  });

  const counts: number[] = [];

  const sub = store.subscribe((s) => counts.push(s.context.count));

  store.send({ type: 'inc' }); // 1
  store.send({ type: 'inc' }); // 2
  store.send({ type: 'inc' }); // 3

  expect(counts).toEqual([1, 2, 3]);

  sub.unsubscribe();

  store.send({ type: 'inc' }); // 4
  store.send({ type: 'inc' }); // 5
  store.send({ type: 'inc' }); // 6

  expect(counts).toEqual([1, 2, 3]);
});

it('can be inspected', () => {
  const store = createStore({
    context: {
      count: 0
    },
    on: {
      inc: (ctx) => ({
        count: ctx.count + 1
      })
    }
  });

  const evs: any[] = [];

  store.inspect((ev) => evs.push(ev));

  store.send({ type: 'inc' });

  expect(evs).toEqual([
    expect.objectContaining({
      type: '@xstate.actor'
    }),
    expect.objectContaining({
      type: '@xstate.snapshot',
      snapshot: expect.objectContaining({ context: { count: 0 } })
    }),
    expect.objectContaining({
      type: '@xstate.event',
      event: { type: 'inc' }
    }),
    expect.objectContaining({
      type: '@xstate.snapshot',
      snapshot: expect.objectContaining({ context: { count: 1 } })
    })
  ]);
});

it('inspection with @statelyai/inspect typechecks correctly', () => {
  const store = createStore({
    context: {},
    on: {}
  });

  const inspector = createBrowserInspector({
    autoStart: false
  });

  store.inspect(inspector.inspect);
});

it('emitted events can be subscribed to', () => {
  const store = createStore({
    context: {
      count: 0
    },
    emits: {
      increased: (a: { upBy: number }) => {}
    },
    on: {
      inc: (ctx, _, enq) => {
        enq.emit.increased({ upBy: 1 });
        return {
          ...ctx,
          count: ctx.count + 1
        };
      }
    }
  });

  const spy = jest.fn();

  store.on('increased', spy);

  store.send({ type: 'inc' });

  expect(spy).toHaveBeenCalledWith({ type: 'increased', upBy: 1 });
});

it('emitted events can be unsubscribed to', () => {
  const store = createStore({
    context: {
      count: 0
    },
    emits: {
      increased: (_: { upBy: number }) => {}
    },
    on: {
      inc: (ctx, _, enq) => {
        enq.emit.increased({ upBy: 1 });

        return {
          ...ctx,
          count: ctx.count + 1
        };
      }
    }
  });

  const spy = jest.fn();
  const sub = store.on('increased', spy);
  store.send({ type: 'inc' });

  expect(spy).toHaveBeenCalledWith({ type: 'increased', upBy: 1 });

  sub.unsubscribe();
  store.send({ type: 'inc' });

  expect(spy).toHaveBeenCalledTimes(1);
});

it('emitted events occur after the snapshot is updated', () => {
  const store = createStore({
    context: {
      count: 0
    },
    emits: {
      increased: (_: { upBy: number }) => {}
    },
    on: {
      inc: (ctx, _, enq) => {
        enq.emit.increased({ upBy: 1 });

        return {
          ...ctx,
          count: ctx.count + 1
        };
      }
    }
  });

  expect.assertions(1);

  store.on('increased', () => {
    const s = store.getSnapshot();

    expect(s.context.count).toEqual(1);
  });

  store.send({ type: 'inc' });
});

it('effects can be enqueued', async () => {
  const store = createStore({
    context: {
      count: 0
    },
    on: {
      inc: (ctx, _, enq) => {
        enq.effect(() => {
          setTimeout(() => {
            store.send({ type: 'dec' });
          }, 5);
        });

        return {
          ...ctx,
          count: ctx.count + 1
        };
      },
      dec: (ctx) => ({
        ...ctx,
        count: ctx.count - 1
      })
    }
  });

  store.send({ type: 'inc' });

  expect(store.getSnapshot().context.count).toEqual(1);

  await new Promise((resolve) => setTimeout(resolve, 10));

  expect(store.getSnapshot().context.count).toEqual(0);
});

describe('store.trigger', () => {
  it('should allow triggering events with a fluent API', () => {
    const store = createStore({
      context: { count: 0 },
      on: {
        increment: (ctx, event: { by: number }) => ({
          count: ctx.count + event.by
        })
      }
    });

    store.trigger.increment({ by: 5 });

    expect(store.getSnapshot().context.count).toBe(5);
  });

  it('should provide type safety for event payloads', () => {
    const store = createStore({
      context: { count: 0 },
      on: {
        increment: (ctx, event: { by: number }) => ({
          count: ctx.count + event.by
        }),
        reset: () => ({ count: 0 })
      }
    });

    // @ts-expect-error - missing required 'by' property
    store.trigger.increment({});

    // @ts-expect-error - extra property not allowed
    store.trigger.increment({ by: 1, extra: true });

    // @ts-expect-error - unknown event
    store.trigger.unknown({});

    // Valid usage with no payload
    store.trigger.reset();

    // Valid usage with payload
    store.trigger.increment({ by: 1 });
  });

  it('should be equivalent to store.send', () => {
    const store = createStore({
      context: { count: 0 },
      on: {
        increment: (ctx, event: { by: number }) => ({
          count: ctx.count + event.by
        })
      }
    });

    const sendSpy = jest.spyOn(store, 'send');

    store.trigger.increment({ by: 5 });

    expect(sendSpy).toHaveBeenCalledWith({
      type: 'increment',
      by: 5
    });
  });
});

describe('getters', () => {
  it('computes values from context', () => {
    const store = createStore({
      context: { count: 2 },
      getters: {
        doubled: (ctx: { count: number }) => ctx.count * 2,
        squared: (ctx: { count: number }) => ctx.count ** 2
      } as const,
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      }
    });

    expect(store.getSnapshot().doubled).toBe(4);
    expect(store.getSnapshot().squared).toBe(4);

    store.send({ type: 'inc' });
    expect(store.getSnapshot().doubled).toBe(6);
    expect(store.getSnapshot().squared).toBe(9);
  });

  it('handles getter dependencies', () => {
    const store = createStore({
      context: { price: 10, quantity: 2 },
      getters: {
        subtotal: (ctx) => ctx.price * ctx.quantity,
        tax: (_, getters: { subtotal: number }): number =>
          getters.subtotal * 0.1,
        total: (_, getters: { subtotal: number; tax: number }): number =>
          getters.subtotal + getters.tax
      },
      on: {
        updatePrice: (ctx, ev: { value: number }) => ({ price: ev.value })
      }
    });

    expect(store.getSnapshot().total).toBeCloseTo(22); // 20 + 2 = 22

    store.send({ type: 'updatePrice', value: 20 });
    expect(store.getSnapshot().total).toBeCloseTo(44); // 40 + 4 = 44
  });

  it('updates getters when context changes', () => {
    const store = createStore({
      context: { items: [] as string[] },
      getters: {
        count: (ctx) => ctx.items.length,
        hasItems: (_, getters: { count: number }): boolean => getters.count > 0
      },
      on: {
        addItem: (ctx, ev: { item: string }) => ({
          items: [...ctx.items, ev.item]
        })
      }
    });

    expect(store.getSnapshot().hasItems).toBe(false);

    store.send({ type: 'addItem', item: 'test' });
    expect(store.getSnapshot().hasItems).toBe(true);
  });

  it('works with immer producer', () => {
    const store = createStoreWithProducer(produce, {
      context: { a: 1, b: 2 },
      getters: {
        sum: (ctx) => ctx.a + ctx.b,
        product: (ctx) => ctx.a * ctx.b
      },
      on: {
        update: (ctx, ev: { a?: number; b?: number }) => {
          if (ev.a !== undefined) ctx.a = ev.a;
          if (ev.b !== undefined) ctx.b = ev.b;
        }
      }
    });

    expect(store.getSnapshot().sum).toBe(3);
    expect(store.getSnapshot().product).toBe(2);

    store.send({ type: 'update', a: 3 });
    expect(store.getSnapshot().sum).toBe(5);
    expect(store.getSnapshot().product).toBe(6);
  });

  it('includes getters in inspection snapshots', () => {
    const store = createStore({
      context: { value: 5 },
      getters: {
        squared: (ctx) => ctx.value ** 2
      },
      on: {
        increment: (ctx) => ({ value: ctx.value + 1 })
      }
    });

    const snapshots: any[] = [];
    store.inspect((ev) => {
      if (ev.type === '@xstate.snapshot') {
        snapshots.push(ev.snapshot);
      }
    });

    store.send({ type: 'increment' });
    store.send({ type: 'increment' });

    expect(snapshots).toEqual([
      expect.objectContaining({ context: { value: 5 }, squared: 25 }),
      expect.objectContaining({ context: { value: 6 }, squared: 36 }),
      expect.objectContaining({ context: { value: 7 }, squared: 49 })
    ]);
  });
});
