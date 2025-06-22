import { createStore } from '../src/index.ts';
import { undoRedo } from '../src/undo.ts';

it('should undo a single event', () => {
  const store = createStore(
    undoRedo({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      }
    })
  );

  store.trigger.inc();
  expect(store.getSnapshot().context.count).toBe(1);

  store.trigger.undo();
  expect(store.getSnapshot().context.count).toBe(0);
});

it('should redo a previously undone event', () => {
  const store = createStore(
    undoRedo({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      }
    })
  );

  store.trigger.inc();
  store.trigger.undo();
  store.trigger.redo();
  expect(store.getSnapshot().context.count).toBe(1);
});

it('should group events by transaction ID', () => {
  const store = createStore(
    undoRedo(
      {
        context: { count: 0 },
        on: {
          inc: (ctx) => ({ count: ctx.count + 1 }),
          dec: (ctx) => ({ count: ctx.count - 1 })
        }
      },
      {
        getTransactionId: (event) => {
          return event.type;
        }
      }
    )
  );

  // First transaction
  store.send({ type: 'inc' });
  store.send({ type: 'inc' });
  expect(store.getSnapshot().context.count).toBe(2);

  // Second transaction
  store.send({ type: 'dec' });
  store.send({ type: 'dec' });
  expect(store.getSnapshot().context.count).toBe(0);

  // Undo second transaction (both decrements)
  store.send({ type: 'undo' });
  expect(store.getSnapshot().context.count).toBe(2);

  // Undo first transaction (both increments)
  store.send({ type: 'undo' });
  expect(store.getSnapshot().context.count).toBe(0);
});

it('should maintain correct state when interleaving undo/redo with new events', () => {
  const store = createStore(
    undoRedo({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 }),
        dec: (ctx) => ({ count: ctx.count - 1 })
      }
    })
  );

  store.trigger.inc(); // 1
  expect(store.getSnapshot().context.count).toBe(1);
  store.trigger.inc(); // 2
  expect(store.getSnapshot().context.count).toBe(2);
  store.trigger.undo(); // 1
  expect(store.getSnapshot().context.count).toBe(1);
  store.send({ type: 'dec' }); // 0
  expect(store.getSnapshot().context.count).toBe(0);
  store.trigger.undo(); // 1
  expect(store.getSnapshot().context.count).toBe(1);
  store.send({ type: 'redo' }); // 0
  expect(store.getSnapshot().context.count).toBe(0);

  expect(store.getSnapshot().context.count).toBe(0);
});

it('should do nothing when undoing with empty history', () => {
  const store = createStore(
    undoRedo({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      }
    })
  );

  const initialSnapshot = store.getSnapshot();
  store.send({ type: 'undo' });
  expect(store.getSnapshot()).toEqual(initialSnapshot);
});

it('should do nothing when redoing with empty undo stack', () => {
  const store = createStore(
    undoRedo({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      }
    })
  );

  const initialSnapshot = store.getSnapshot();
  store.send({ type: 'redo' });
  expect(store.getSnapshot()).toEqual(initialSnapshot);
});

it('should clear redo stack when new events occur after undo', () => {
  const store = createStore(
    undoRedo({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 }),
        dec: (ctx) => ({ count: ctx.count - 1 })
      }
    })
  );

  store.send({ type: 'inc' }); // 1
  expect(store.getSnapshot().context.count).toBe(1);
  store.send({ type: 'inc' }); // 2
  expect(store.getSnapshot().context.count).toBe(2);
  store.send({ type: 'undo' }); // 1
  expect(store.getSnapshot().context.count).toBe(1);
  store.send({ type: 'dec' }); // 0

  // Redo should not work as we added a new event after undo
  store.send({ type: 'redo' });
  expect(store.getSnapshot().context.count).toBe(0);
});

it('should preserve emitted events during undo/redo', () => {
  type Events = { type: 'inc' };

  const store = createStore(
    undoRedo({
      context: { count: 0 },
      emits: {
        changed: (_: { value: number }) => {}
      },
      on: {
        inc: (ctx, _: Events, enq) => {
          enq.emit.changed({ value: ctx.count + 1 });
          return { count: ctx.count + 1 };
        }
      }
    })
  );

  const emittedEvents: any[] = [];
  store.on('changed', (event) => {
    emittedEvents.push(event);
  });

  store.send({ type: 'inc' });
  store.send({ type: 'undo' });
  store.send({ type: 'redo' });

  expect(emittedEvents).toEqual([
    { type: 'changed', value: 1 },
    { type: 'changed', value: 1 }
  ]);
});
