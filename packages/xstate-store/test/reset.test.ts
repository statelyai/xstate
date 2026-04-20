import { createStore } from '../src/index.ts';
import { reset } from '../src/reset.ts';
import { undoRedo } from '../src/undo.ts';

describe('reset extension', () => {
  it('should reset to initial context', () => {
    const store = createStore({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      }
    }).with(reset());

    store.trigger.inc();
    store.trigger.inc();
    expect(store.getSnapshot().context.count).toBe(2);

    store.trigger.reset();
    expect(store.getSnapshot().context.count).toBe(0);
  });

  it('should reset multiple fields to initial context', () => {
    const store = createStore({
      context: { count: 0, name: 'Ada' },
      on: {
        inc: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
        setName: (ctx, e: { name: string }) => ({ ...ctx, name: e.name })
      }
    }).with(reset());

    store.trigger.inc();
    store.trigger.setName({ name: 'Bob' });
    expect(store.getSnapshot().context).toEqual({ count: 1, name: 'Bob' });

    store.trigger.reset();
    expect(store.getSnapshot().context).toEqual({ count: 0, name: 'Ada' });
  });

  it('should support partial reset via `to` option', () => {
    const store = createStore({
      context: { count: 0, user: null as string | null },
      on: {
        inc: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
        login: (ctx, e: { user: string }) => ({ ...ctx, user: e.user })
      }
    }).with(
      reset({
        to: (initial, current) => ({ ...initial, user: current.user })
      })
    );

    store.trigger.inc();
    store.trigger.inc();
    store.trigger.login({ user: 'Alice' });
    expect(store.getSnapshot().context).toEqual({ count: 2, user: 'Alice' });

    store.trigger.reset();
    expect(store.getSnapshot().context).toEqual({ count: 0, user: 'Alice' });
  });

  it('should be idempotent when no changes have been made', () => {
    const store = createStore({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      }
    }).with(reset());

    const before = store.getSnapshot();
    store.trigger.reset();
    expect(store.getSnapshot().context).toEqual(before.context);
  });

  it('should preserve snapshot status', () => {
    const store = createStore({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      }
    }).with(reset());

    store.trigger.inc();
    store.trigger.reset();
    expect(store.getSnapshot().status).toBe('active');
  });

  it('should notify subscribers on reset', () => {
    const store = createStore({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      }
    }).with(reset());

    const snapshots: number[] = [];
    store.subscribe((snap) => snapshots.push(snap.context.count));

    store.trigger.inc(); // 1
    store.trigger.inc(); // 2
    store.trigger.reset(); // 0

    expect(snapshots).toEqual([1, 2, 0]);
  });

  it('should work with undoRedo (reset is undoable)', () => {
    const store = createStore({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      }
    })
      .with(reset())
      .with(undoRedo());

    store.trigger.inc();
    store.trigger.inc();
    expect(store.getSnapshot().context.count).toBe(2);

    store.trigger.reset();
    expect(store.getSnapshot().context.count).toBe(0);

    store.trigger.undo();
    expect(store.getSnapshot().context.count).toBe(2);
  });

  it('should allow resetting after multiple operations', () => {
    const store = createStore({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 }),
        dec: (ctx) => ({ count: ctx.count - 1 })
      }
    }).with(reset());

    store.trigger.inc();
    store.trigger.inc();
    store.trigger.dec();
    store.trigger.inc();
    expect(store.getSnapshot().context.count).toBe(2);

    store.trigger.reset();
    expect(store.getSnapshot().context.count).toBe(0);

    // Should still work after reset
    store.trigger.inc();
    expect(store.getSnapshot().context.count).toBe(1);
  });

  it('should return initial snapshot from getInitialSnapshot', () => {
    const store = createStore({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      }
    }).with(reset());

    store.trigger.inc();
    store.trigger.inc();

    expect(store.getInitialSnapshot().context.count).toBe(0);
  });
});
