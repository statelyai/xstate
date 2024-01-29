import { createStore } from '../src/index.ts';

it('creates a store API', () => {
  const store = createStore({});

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

it('1', () => {
  const store = createStore(
    {
      count: 0
    },
    {
      inc: (c, ev: { type: 'inc'; by: number }) => {
        c.count += ev.by;
      }
    }
  );

  const initial = store.getInitialSnapshot();

  store.inc({ by: 1 });

  const next = store.getSnapshot();

  expect(initial).toEqual({ count: 0 });
  expect(next).toEqual({ count: 1 });
});

it('store', () => {
  const store = createStore(
    {
      count: 0
    },
    {
      inc: (ctx, ev: { by: number }) => {
        ctx.count += ev.by;
      },
      dec: (ctx, ev: { by: number }) => {
        ctx.count -= ev.by;
      }
    }
  );

  store.send({ type: 'inc', by: 9 });
  store.inc({ by: 1 });
  store.send({ type: 'inc', by: 3 });
  store.dec({ by: 3 });

  expect(store.getSnapshot()).toEqual({ count: 10 });
});

it('works with any context', () => {
  const store = createStore(0, {
    inc: (ctx) => {
      ctx++;
    },
    dec: (ctx) => {
      ctx--;
    }
  });
});
