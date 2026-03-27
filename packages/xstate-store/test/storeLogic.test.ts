import { describe, it, expect } from 'vitest';
import { createStore, createStoreLogic, createAtom } from '../src/index.ts';
import { reset } from '../src/reset.ts';

describe('createStoreLogic', () => {
  it('creates multiple store instances from the same logic', () => {
    const counterLogic = createStoreLogic({
      context: (input: { initialCount: number }) => ({
        count: input.initialCount
      }),
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 }),
        dec: (ctx) => ({ count: ctx.count - 1 })
      }
    });

    const store1 = counterLogic.createStore({ initialCount: 42 });
    const store2 = counterLogic.createStore({ initialCount: 0 });

    expect(store1.getSnapshot().context.count).toBe(42);
    expect(store2.getSnapshot().context.count).toBe(0);

    store1.trigger.inc();
    expect(store1.getSnapshot().context.count).toBe(43);
    expect(store2.getSnapshot().context.count).toBe(0);
  });

  it('supports selectors that return reactive atoms', () => {
    const counterLogic = createStoreLogic({
      context: (input: { initialCount: number }) => ({
        count: input.initialCount
      }),
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      },
      selectors: {
        doubled: (ctx) => ctx.count * 2,
        isPositive: (ctx) => ctx.count > 0
      }
    });

    const store = counterLogic.createStore({ initialCount: 5 });

    expect(store.selectors.doubled.get()).toBe(10);
    expect(store.selectors.isPositive.get()).toBe(true);

    store.trigger.inc();
    expect(store.selectors.doubled.get()).toBe(12);
  });

  it('each instance gets independent selectors', () => {
    const counterLogic = createStoreLogic({
      context: (input: { initialCount: number }) => ({
        count: input.initialCount
      }),
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      },
      selectors: {
        doubled: (ctx) => ctx.count * 2
      }
    });

    const store1 = counterLogic.createStore({ initialCount: 10 });
    const store2 = counterLogic.createStore({ initialCount: 20 });

    expect(store1.selectors.doubled.get()).toBe(20);
    expect(store2.selectors.doubled.get()).toBe(40);

    store1.trigger.inc();
    expect(store1.selectors.doubled.get()).toBe(22);
    expect(store2.selectors.doubled.get()).toBe(40);
  });

  it('works without input (static context)', () => {
    const todoLogic = createStoreLogic({
      context: { todos: [] as string[] },
      on: {
        add: (ctx, ev: { text: string }) => ({
          todos: [...ctx.todos, ev.text]
        })
      },
      selectors: {
        count: (ctx) => ctx.todos.length,
        isEmpty: (ctx) => ctx.todos.length === 0
      }
    });

    const store = todoLogic.createStore();

    expect(store.selectors.count.get()).toBe(0);
    expect(store.selectors.isEmpty.get()).toBe(true);

    store.trigger.add({ text: 'hello' });
    expect(store.selectors.count.get()).toBe(1);
    expect(store.selectors.isEmpty.get()).toBe(false);
  });

  it('works without selectors', () => {
    const logic = createStoreLogic({
      context: (input: { n: number }) => ({ count: input.n }),
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      }
    });

    const store = logic.createStore({ n: 5 });
    expect(store.getSnapshot().context.count).toBe(5);
    store.trigger.inc();
    expect(store.getSnapshot().context.count).toBe(6);
  });

  it('.with() preserves selectors', () => {
    const counterLogic = createStoreLogic({
      context: (input: { initialCount: number }) => ({
        count: input.initialCount
      }),
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      },
      selectors: {
        doubled: (ctx) => ctx.count * 2
      }
    });

    const store = counterLogic.createStore({ initialCount: 10 }).with(reset());

    expect(store.selectors.doubled.get()).toBe(20);

    store.trigger.inc();
    expect(store.selectors.doubled.get()).toBe(22);

    store.trigger.reset();
    expect(store.selectors.doubled.get()).toBe(20);
  });

  it('selectors are subscribable atoms', () => {
    const counterLogic = createStoreLogic({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      },
      selectors: {
        doubled: (ctx) => ctx.count * 2
      }
    });

    const store = counterLogic.createStore();
    const values: number[] = [];

    store.selectors.doubled.subscribe((v) => values.push(v));

    store.trigger.inc();
    store.trigger.inc();
    store.trigger.inc();

    expect(values).toEqual([2, 4, 6]);
  });

  it('selectors can be composed with createAtom', () => {
    const counterLogic = createStoreLogic({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      },
      selectors: {
        doubled: (ctx) => ctx.count * 2,
        tripled: (ctx) => ctx.count * 3
      }
    });

    const store = counterLogic.createStore();

    const sum = createAtom(
      () => store.selectors.doubled.get() + store.selectors.tripled.get()
    );

    expect(sum.get()).toBe(0);

    store.trigger.inc();
    expect(sum.get()).toBe(5); // 2 + 3
  });

  it('supports emits', () => {
    const logic = createStoreLogic({
      context: { count: 0 },
      on: {
        inc: (
          ctx: { count: number },
          _ev: {},
          enq: {
            emit: { changed: (p: { count: number }) => void };
            effect: (fn: () => void) => void;
          }
        ) => {
          enq.emit.changed({ count: ctx.count + 1 });
          return { count: ctx.count + 1 };
        }
      },
      emits: {
        changed: (_payload: { count: number }) => {}
      },
      selectors: {
        doubled: (ctx) => ctx.count * 2
      }
    });

    const store = logic.createStore();
    const emitted: any[] = [];

    store.on('changed', (ev) => emitted.push(ev));
    store.trigger.inc();

    expect(emitted).toEqual([{ type: 'changed', count: 1 }]);
    expect(store.selectors.doubled.get()).toBe(2);
  });

  it('stores are fully independent (no shared state)', () => {
    const logic = createStoreLogic({
      context: { items: [] as string[] },
      on: {
        add: (ctx, ev: { item: string }) => ({
          items: [...ctx.items, ev.item]
        })
      }
    });

    const store1 = logic.createStore();
    const store2 = logic.createStore();

    store1.trigger.add({ item: 'a' });
    store2.trigger.add({ item: 'x' });
    store2.trigger.add({ item: 'y' });

    expect(store1.getSnapshot().context.items).toEqual(['a']);
    expect(store2.getSnapshot().context.items).toEqual(['x', 'y']);
  });
});

describe('createStore with selectors', () => {
  it('supports selectors config', () => {
    const store = createStore({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      },
      selectors: {
        doubled: (ctx) => ctx.count * 2,
        isEven: (ctx) => ctx.count % 2 === 0
      }
    });

    expect(store.selectors.doubled.get()).toBe(0);
    expect(store.selectors.isEven.get()).toBe(true);

    store.trigger.inc();
    expect(store.selectors.doubled.get()).toBe(2);
    expect(store.selectors.isEven.get()).toBe(false);
  });

  it('.with() preserves selectors', () => {
    const store = createStore({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      },
      selectors: {
        doubled: (ctx) => ctx.count * 2
      }
    }).with(reset());

    store.trigger.inc();
    store.trigger.inc();
    expect(store.selectors.doubled.get()).toBe(4);

    store.trigger.reset();
    expect(store.selectors.doubled.get()).toBe(0);
  });

  it('selectors are reactive atoms', () => {
    const store = createStore({
      context: { name: 'Ada', age: 30 },
      on: {
        setName: (ctx, ev: { name: string }) => ({ ...ctx, name: ev.name }),
        birthday: (ctx) => ({ ...ctx, age: ctx.age + 1 })
      },
      selectors: {
        greeting: (ctx) => `Hello, ${ctx.name}!`,
        isAdult: (ctx) => ctx.age >= 18
      }
    });

    const greetings: string[] = [];
    store.selectors.greeting.subscribe((v) => greetings.push(v));

    store.trigger.setName({ name: 'Grace' });
    expect(greetings).toEqual(['Hello, Grace!']);
    expect(store.selectors.isAdult.get()).toBe(true);
  });

  it('works without selectors (backward compatible)', () => {
    const store = createStore({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      }
    });

    // Should still work as a normal store
    store.trigger.inc();
    expect(store.getSnapshot().context.count).toBe(1);

    // select() still works
    const doubled = store.select((ctx) => ctx.count * 2);
    expect(doubled.get()).toBe(2);
  });
});
