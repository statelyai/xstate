import { produce } from 'immer';
import { createStore, createStoreWithProducer } from '../src/index.ts';

it('creates a store API', () => {
  const store = createStore({}, {});

  expect(store).toMatchInlineSnapshot(`
    {
      "@@observable": [Function],
      "getInitialSnapshot": [Function],
      "getSnapshot": [Function],
      "send": [Function],
      "subscribe": [Function],
    }
  `);
});

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

  expect(initial).toEqual({ count: 0 });
  expect(next).toEqual({ count: 1 });
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
  expect(store.getSnapshot()).toEqual({ count: 1, greeting: 'hello' });

  store.send({
    type: 'updateBoth'
  });
  expect(store.getSnapshot()).toEqual({ count: 42, greeting: 'hi' });
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
  expect(store.getSnapshot()).toEqual({ count: 0 });
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

  expect(store.getSnapshot()).toEqual({ count: 6 });
  store.send({ type: 'clear' });

  expect(store.getSnapshot()).toEqual({ count: 0 });
});

it('works with a custom API', () => {
  const store = createStore(
    {
      count: 0
    },
    {
      inc: (ctx) => {
        return { count: ctx.count + 1 };
      }
    },
    (ctx, recipe) => {
      const cloned = { ...ctx };
      return recipe(cloned);
    }
  );

  store.send({ type: 'inc' });

  expect(store.getSnapshot()).toEqual({ count: 1 });
  expect(store.getInitialSnapshot()).toEqual({ count: 0 });
});

it('works with immer', () => {
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

  expect(store.getSnapshot()).toEqual({ count: 3 });
  expect(store.getInitialSnapshot()).toEqual({ count: 0 });
});
