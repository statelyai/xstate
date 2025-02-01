import { produce } from 'immer';
import { createStore, createStoreWithProducer } from '../src/index.ts';
import { createBrowserInspector } from '@statelyai/inspect';

it('updates a store with an event without mutating original context', () => {
  const context = { count: 0 };
  const store = createStore(context, {
    inc: (context, event: { by: number }) => {
      return {
        count: context.count + event.by
      };
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
  const store = createStore(
    { count: 0, greeting: 'hello' },
    {
      inc: (ctx: { count: number }) => ({ count: ctx.count + 1 }),
      updateBoth: () => ({
        count: 42,
        greeting: 'hi'
      })
    }
  );

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
  const store = createStore(
    { count: 0 },
    {
      inc: {
        count: (ctx) => ctx.count + 1
      }
    }
  );

  store.send({
    type: 'unknown'
  });
  expect(store.getSnapshot().context).toEqual({ count: 0 });
});

it('updates state from sent events', () => {
  const store = createStore(
    {
      count: 0
    },
    {
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
  );

  store.send({ type: 'inc', by: 9 });
  store.send({ type: 'dec', by: 3 });

  expect(store.getSnapshot().context).toEqual({ count: 6 });
  store.send({ type: 'clear' });

  expect(store.getSnapshot().context).toEqual({ count: 0 });
});

it('createStoreWithProducer(…) works with an immer producer', () => {
  const store = createStoreWithProducer(
    produce,
    {
      count: 0
    },
    {
      inc: (ctx, ev: { by: number }) => {
        ctx.count += ev.by;
      }
    }
  );

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
  const store = createStoreWithProducer(
    produce,
    {
      count: 0
    },
    {
      inc: (ctx, ev: { by: number }) => {
        ctx.count += ev.by;
      }
    }
  );

  store.getSnapshot().context satisfies { count: number };
});

it('createStoreWithProducer(…) infers the context type properly with a producer (object API)', () => {
  const store = createStoreWithProducer(produce, {
    context: {
      count: 0
    },
    on: {
      inc: (ctx, ev: { by: number }, enq) => {
        ctx.count += ev.by;
      }
    }
  });

  store.getSnapshot().context satisfies { count: number };
});

it('can be observed', () => {
  const store = createStore(
    {
      count: 0
    },
    {
      inc: {
        count: (ctx) => ctx.count + 1
      }
    }
  );

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
  const store = createStore(
    {
      count: 0
    },
    {
      inc: {
        count: (ctx) => ctx.count + 1
      }
    }
  );

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
    types: {
      emitted: {} as
        | { type: 'increased'; upBy: number }
        | { type: 'decreased'; downBy: number }
    },
    context: {
      count: 0
    },
    on: {
      inc: (ctx, _, enq) => {
        enq.emit({ type: 'increased', upBy: 1 });

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
    types: {
      emitted: {} as
        | { type: 'increased'; upBy: number }
        | { type: 'decreased'; downBy: number }
    },
    context: {
      count: 0
    },
    on: {
      inc: (ctx, _, enq) => {
        enq.emit({ type: 'increased', upBy: 1 });

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
    types: {
      emitted: {} as { type: 'increased'; upBy: number }
    },
    context: {
      count: 0
    },
    on: {
      inc: (ctx, _, enq) => {
        enq.emit({ type: 'increased', upBy: 1 });

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

it('computes getters from context', () => {
  const store = createStore({
    context: { count: 2 },
    getters: {
      double: (ctx: { count: number }) => ctx.count * 2,
      squared: (ctx: { count: number }) => ctx.count ** 2
    },
    on: {
      inc: (ctx) => ({ count: ctx.count + 1 })
    }
  });

  expect(store.getSnapshot().double).toBe(4);
  expect(store.getSnapshot().squared).toBe(4);

  store.send({ type: 'inc' });

  expect(store.getSnapshot().double).toBe(6);
  expect(store.getSnapshot().squared).toBe(9);
});

it('updates getters when context changes', () => {
  const store = createStore(
    { count: 1 },
    {
      inc: (ctx: { count: number }) => ({ count: ctx.count + 1 })
    },
    {
      triple: (ctx: { count: number }) => ctx.count * 3
    }
  );

  expect(store.getSnapshot().triple).toBe(3);
  store.send({ type: 'inc' });
  expect(store.getSnapshot().triple).toBe(6);
});

it('works with immer producer and getters', () => {
  const store = createStoreWithProducer(produce, {
    context: { a: 1, b: 2 },
    getters: {
      sum: (ctx: { a: number; b: number }) => ctx.a + ctx.b,
      product: (ctx: { a: number; b: number }) => ctx.a * ctx.b
    },
    on: {
      update: (ctx, ev: { type: 'update'; a?: number; b?: number }) => {
        if (ev.a !== undefined) ctx.a = ev.a;
        if (ev.b !== undefined) ctx.b = ev.b;
      }
    }
  });

  expect(store.getSnapshot().sum).toBe(3);
  expect(store.getSnapshot().product).toBe(2);

  store.send({ type: 'update', a: 3 });
  expect(store.getSnapshot().sum).toBe(5); // 3 + 2
  expect(store.getSnapshot().product).toBe(6); // 3 * 2
});

it('handles getter dependencies', () => {
  const store = createStore({
    context: { price: 10, quantity: 5 },
    getters: {
      subtotal: (ctx: { price: number; quantity: number }) =>
        ctx.price * ctx.quantity,
      taxRate: () => 0.1,
      total: (_ctx, getters) => getters.subtotal * (1 + getters.taxRate)
    },
    on: {
      updatePrice: (_ctx, ev: { type: 'updatePrice'; price: number }) => ({
        price: ev.price
      })
    }
  });

  expect(store.getSnapshot().total).toBeCloseTo(55); // 10*5*1.1 = 55

  store.send({ type: 'updatePrice', price: 20 });
  expect(store.getSnapshot().total).toBeCloseTo(110); // 20*5*1.1 = 110
});

it('includes getters in subscriptions', () => {
  const store = createStore({
    context: { count: 0 },
    getters: {
      doubled: (ctx) => ctx.count * 2
    },
    on: {
      inc: (ctx) => ({ count: ctx.count + 1 })
    }
  });

  const values: number[] = [];
  store.subscribe((s) => values.push(s.doubled));

  store.send({ type: 'inc' });
  store.send({ type: 'inc' });
  store.send({ type: 'inc' });

  expect(values).toEqual([2, 4, 6]);
});

it('handles getters with no context dependencies', () => {
  const store = createStore({
    context: { count: 0 },
    getters: {
      random: () => Math.random(),
      fixed: () => 42
    },
    on: {
      inc: (ctx) => ({ count: ctx.count + 1 })
    }
  });

  const initial = store.getSnapshot();
  store.send({ type: 'inc' });
  const next = store.getSnapshot();

  expect(initial.fixed).toBe(42);
  expect(next.fixed).toBe(42);
  expect(initial.random).not.toBe(next.random);
});
