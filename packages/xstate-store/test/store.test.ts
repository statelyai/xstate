import { produce } from 'immer';
import { createStore, createStoreWithProducer } from '../src/index.ts';

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
      inc: {
        count: (ctx) => ctx.count + 1
      },
      updateBoth: {
        count: () => 42,
        greeting: 'hi'
      }
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
    // @ts-expect-error
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
