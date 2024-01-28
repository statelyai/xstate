import { createStore } from '../src/index.ts';

it('creates a store API', () => {
  const store = createStore({});

  expect(store).toMatchInlineSnapshot(`
    {
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

  store.send.inc({ by: 1 });

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
      inc: (ctx, ev: { type: 'inc'; by: number }) => {
        ctx.count += ev.by;
      }
    }
  );

  store.send.inc({ by: 1 });
  store.send({ type: 'inc', by: 9 });

  expect(store.getSnapshot()).toEqual({ count: 10 });
});
