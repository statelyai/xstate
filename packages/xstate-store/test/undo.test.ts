import { createStore } from '../src/index.ts';
import { undoRedo, undoRedoSnapshot } from '../src/undo.ts';

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

it('should undo/redo multiple events, non-transactional', () => {
  const store = createStore(
    undoRedo({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      }
    })
  );

  store.trigger.inc();
  store.trigger.inc();
  store.trigger.inc();
  expect(store.getSnapshot().context.count).toBe(3);
  store.trigger.undo();
  expect(store.getSnapshot().context.count).toBe(2);
  store.trigger.undo();
  expect(store.getSnapshot().context.count).toBe(1);
  store.trigger.redo();
  expect(store.getSnapshot().context.count).toBe(2);
  store.trigger.redo();
  expect(store.getSnapshot().context.count).toBe(3);
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

it('should preserve context and event types', () => {
  const store = createStore(
    undoRedo({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      }
    })
  );

  store.getSnapshot().context satisfies { count: number };
  store.send({ type: 'inc' });
  store.send({ type: 'undo' });
  store.send({ type: 'redo' });

  // @ts-expect-error
  store.getSnapshot().context.foo;

  // @ts-expect-error
  store.send({ type: 'dec' });
});

it('should skip non-undoable events during undo', () => {
  const store = createStore(
    undoRedo(
      {
        context: { count: 0 },
        on: {
          inc: (ctx) => ({ count: ctx.count + 1 }),
          log: (ctx) => ctx // No state change, just logging
        }
      },
      {
        skipEvent: (event) => event.type === 'log'
      }
    )
  );

  store.send({ type: 'inc' }); // count = 1
  store.send({ type: 'log' }); // count = 1 (logged but not undoable)
  store.send({ type: 'inc' }); // count = 2
  expect(store.getSnapshot().context.count).toBe(2);

  store.send({ type: 'undo' }); // count = 1 (skips log event)
  expect(store.getSnapshot().context.count).toBe(1);
});

it('should skip non-redoable events during redo', () => {
  const store = createStore(
    undoRedo(
      {
        context: { count: 0 },
        on: {
          inc: (ctx) => ({ count: ctx.count + 1 }),
          log: (ctx) => ctx // No state change, just logging
        }
      },
      {
        skipEvent: (event) => event.type === 'log'
      }
    )
  );

  store.send({ type: 'inc' }); // count = 1
  store.send({ type: 'log' }); // count = 1 (logged but not redoable)
  store.send({ type: 'inc' }); // count = 2
  store.send({ type: 'undo' }); // count = 1
  expect(store.getSnapshot().context.count).toBe(1);

  store.send({ type: 'redo' }); // count = 2 (skips log event)
  expect(store.getSnapshot().context.count).toBe(2);
});

it('should skip events with transaction grouping', () => {
  const store = createStore(
    undoRedo(
      {
        context: { count: 0 },
        on: {
          inc: (ctx) => ({ count: ctx.count + 1 }),
          log: (ctx) => ctx // No state change, just logging
        }
      },
      {
        getTransactionId: (event) => event.type,
        skipEvent: (event) => event.type === 'log'
      }
    )
  );

  // First transaction: inc events
  store.send({ type: 'inc' }); // count = 1
  store.send({ type: 'inc' }); // count = 2
  expect(store.getSnapshot().context.count).toBe(2);

  // Log events (not a transaction because they're skipped)
  store.send({ type: 'log' }); // count = 2 (logged but not undoable)
  store.send({ type: 'log' }); // count = 2 (logged but not undoable)
  expect(store.getSnapshot().context.count).toBe(2);

  // Second transaction: inc events
  store.send({ type: 'inc' }); // count = 3
  store.send({ type: 'inc' }); // count = 4
  expect(store.getSnapshot().context.count).toBe(4);

  // Undo second transaction (all inc events)
  store.send({ type: 'undo' }); // count = 0
  expect(store.getSnapshot().context.count).toBe(0);
});

it('should handle mixed undoable and non-undoable events', () => {
  const store = createStore(
    undoRedo(
      {
        context: { count: 0, logs: [] as string[] },
        on: {
          inc: (ctx) => ({ count: ctx.count + 1, logs: ctx.logs }),
          log: (ctx, event: { type: 'log'; message: string }) => ({
            logs: [...(ctx.logs || []), event.message],
            count: ctx.count
          })
        }
      },
      {
        skipEvent: (event) => event.type === 'log'
      }
    )
  );

  store.send({ type: 'inc' }); // count = 1
  store.send({ type: 'log', message: 'first log' }); // logs = ['first log'] (not stored in history)
  store.send({ type: 'inc' }); // count = 2
  store.send({ type: 'log', message: 'second log' }); // logs = ['first log', 'second log'] (not stored in history)
  store.send({ type: 'inc' }); // count = 3

  expect(store.getSnapshot().context.count).toBe(3);
  expect(store.getSnapshot().context.logs).toEqual(['first log', 'second log']);

  // Undo should skip log events (they're not in history) but still undo inc events
  // Since log events are skipped, they're not replayed during undo, so logs are lost
  store.send({ type: 'undo' }); // count = 2, logs = [] (logs lost because not replayed)
  expect(store.getSnapshot().context.count).toBe(2);
  expect(store.getSnapshot().context.logs).toEqual([]);

  store.send({ type: 'undo' }); // count = 1, logs = [] (logs lost because not replayed)
  expect(store.getSnapshot().context.count).toBe(1);
  expect(store.getSnapshot().context.logs).toEqual([]);

  store.send({ type: 'undo' }); // count = 0, logs = [] (logs lost because not replayed)
  expect(store.getSnapshot().context.count).toBe(0);
  expect(store.getSnapshot().context.logs).toEqual([]);
});

it('should not replay emitted events for skipped events during undo/redo', () => {
  type Events = { type: 'inc' } | { type: 'log'; message: string };

  const store = createStore(
    undoRedo(
      {
        context: { count: 0 },
        emits: {
          changed: (_: { value: number }) => {},
          logged: (_: { message: string }) => {}
        },
        on: {
          inc: (ctx, _: Events, enq) => {
            enq.emit.changed({ value: ctx.count + 1 });
            return { count: ctx.count + 1 };
          },
          log: (ctx, event: Events, enq) => {
            enq.emit.logged({ message: (event as any).message });
            return ctx; // No state change
          }
        }
      },
      {
        skipEvent: (event) => event.type === 'log'
      }
    )
  );

  const emittedEvents: any[] = [];
  store.on('changed', (event) => {
    emittedEvents.push(event);
  });
  store.on('logged', (event) => {
    emittedEvents.push(event);
  });

  store.send({ type: 'inc' }); // count = 1, emits changed(1)
  store.send({ type: 'log', message: 'test log' }); // emits logged('test log') but not stored in history
  store.send({ type: 'inc' }); // count = 2, emits changed(2)

  expect(emittedEvents).toEqual([
    { type: 'changed', value: 1 },
    { type: 'logged', message: 'test log' },
    { type: 'changed', value: 2 }
  ]);

  emittedEvents.length = 0;
  store.send({ type: 'undo' }); // count = 1
  store.send({ type: 'undo' }); // count = 0
  store.send({ type: 'redo' }); // count = 1, emits changed(1)
  store.send({ type: 'redo' }); // count = 2, emits changed(2)

  // Only inc events should be emitted during undo/redo, log events are skipped from history
  expect(emittedEvents).toEqual([
    { type: 'changed', value: 1 },
    { type: 'changed', value: 2 }
  ]);
});

it('should skip events with transaction grouping', () => {
  const store = createStore(
    undoRedo(
      {
        context: { count: 0, transactionId: null as string | null },
        on: {
          inc: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
          transactionIdUpdated: (ctx, event: { id: string }) => ({
            ...ctx,
            transactionId: event.id
          })
        }
      },
      {
        getTransactionId: (_, snapshot) => snapshot.context.transactionId
      }
    )
  );

  store.send({ type: 'inc' }); // count = 1
  store.send({ type: 'transactionIdUpdated', id: '1' });
  store.send({ type: 'inc' });
  store.send({ type: 'inc' });
  store.send({ type: 'inc' }); // count = 4
  store.send({ type: 'transactionIdUpdated', id: '2' });
  store.send({ type: 'inc' });
  store.send({ type: 'inc' });
  store.send({ type: 'inc' }); // count = 7

  store.send({ type: 'undo' });
  expect(store.getSnapshot().context.count).toBe(4);
  store.send({ type: 'undo' });
  expect(store.getSnapshot().context.count).toBe(1);
  store.send({ type: 'redo' });
  expect(store.getSnapshot().context.count).toBe(4);
  store.send({ type: 'redo' });
  expect(store.getSnapshot().context.count).toBe(7);
});

it('should use the snapshot in the skipEvent function', () => {
  const store = createStore(
    undoRedo(
      {
        context: { count: 0 },
        on: {
          inc: (ctx) => ({ count: ctx.count + 1 })
        }
      },
      {
        skipEvent: (_event, snapshot) => {
          return snapshot.context.count >= 3;
        }
      }
    )
  );

  store.send({ type: 'inc' }); // count = 1
  store.send({ type: 'inc' }); // count = 2
  store.send({ type: 'inc' }); // count = 3
  store.send({ type: 'inc' }); // count = 4 (skipped)
  expect(store.getSnapshot().context.count).toBe(4);
  store.send({ type: 'undo' }); // count = 2
  expect(store.getSnapshot().context.count).toBe(2);
});

it('emit event types should be correct', () => {
  const store = createStore(
    undoRedo({
      context: { count: 0 },
      emits: {
        changed: (_: { value: number }) => {}
      },
      on: {
        // TODO: figure out why we need _: {} and not just _
        inc: (ctx, _: {}, enq) => {
          enq.emit.changed({ value: ctx.count + 1 });
          // @ts-expect-error
          enq.emit.whatever();
          return { count: ctx.count + 1 };
        }
      }
    })
  );

  store.on('changed', (event) => {
    event.value satisfies number;
    // @ts-expect-error
    event.value satisfies string;
    // @ts-expect-error
    event.unknown;
  });

  store.on(
    // @ts-expect-error
    'whatever',
    () => {}
  );
});

describe('undoRedoSnapshot', () => {
  it('should undo a single event', () => {
    const store = createStore(
      undoRedoSnapshot({
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
      undoRedoSnapshot({
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

  it('should undo/redo multiple events, non-transactional', () => {
    const store = createStore(
      undoRedoSnapshot({
        context: { count: 0 },
        on: {
          inc: (ctx) => ({ count: ctx.count + 1 })
        }
      })
    );

    store.trigger.inc();
    store.trigger.inc();
    store.trigger.inc();
    expect(store.getSnapshot().context.count).toBe(3);
    store.trigger.undo();
    expect(store.getSnapshot().context.count).toBe(2);
    store.trigger.undo();
    expect(store.getSnapshot().context.count).toBe(1);
    store.trigger.redo();
    expect(store.getSnapshot().context.count).toBe(2);
    store.trigger.redo();
    expect(store.getSnapshot().context.count).toBe(3);
  });

  it('should group events by transaction ID', () => {
    const store = createStore(
      undoRedoSnapshot(
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
      undoRedoSnapshot({
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
      undoRedoSnapshot({
        context: { count: 0 },
        on: {
          inc: (ctx) => ({ count: ctx.count + 1 })
        }
      })
    );

    const initialSnapshot = store.getSnapshot();
    store.send({ type: 'undo' });
    expect(store.getSnapshot().context).toEqual(initialSnapshot.context);
  });

  it('should do nothing when redoing with empty future stack', () => {
    const store = createStore(
      undoRedoSnapshot({
        context: { count: 0 },
        on: {
          inc: (ctx) => ({ count: ctx.count + 1 })
        }
      })
    );

    const initialSnapshot = store.getSnapshot();
    store.send({ type: 'redo' });
    expect(store.getSnapshot().context).toEqual(initialSnapshot.context);
  });

  it('should clear redo stack when new events occur after undo', () => {
    const store = createStore(
      undoRedoSnapshot({
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

  it('should skip non-undoable events', () => {
    const store = createStore(
      undoRedoSnapshot(
        {
          context: { count: 0 },
          on: {
            inc: (ctx) => ({ count: ctx.count + 1 }),
            log: (ctx) => ctx // No state change, just logging
          }
        },
        {
          skipEvent: (event) => event.type === 'log'
        }
      )
    );

    store.send({ type: 'inc' }); // count = 1
    store.send({ type: 'log' }); // count = 1 (logged but not tracked)
    store.send({ type: 'inc' }); // count = 2
    expect(store.getSnapshot().context.count).toBe(2);

    store.send({ type: 'undo' }); // count = 1 (skips log event)
    expect(store.getSnapshot().context.count).toBe(1);
  });

  it('should respect historyLimit', () => {
    const store = createStore(
      undoRedoSnapshot(
        {
          context: { count: 0 },
          on: {
            inc: (ctx) => ({ count: ctx.count + 1 })
          }
        },
        {
          historyLimit: 2
        }
      )
    );

    store.trigger.inc(); // 1
    store.trigger.inc(); // 2
    store.trigger.inc(); // 3
    store.trigger.inc(); // 4

    // Can only undo 2 times because of history limit
    store.trigger.undo(); // 3
    expect(store.getSnapshot().context.count).toBe(3);
    store.trigger.undo(); // 2
    expect(store.getSnapshot().context.count).toBe(2);
    store.trigger.undo(); // Should stay at 2 (limit reached)
    expect(store.getSnapshot().context.count).toBe(2);
  });

  it('should apply historyLimit during redo', () => {
    const store = createStore(
      undoRedoSnapshot(
        {
          context: { count: 0 },
          on: {
            inc: (ctx) => ({ count: ctx.count + 1 })
          }
        },
        {
          historyLimit: 2
        }
      )
    );

    store.trigger.inc(); // 1
    store.trigger.inc(); // 2
    store.trigger.undo(); // 1
    store.trigger.undo(); // 0
    store.trigger.redo(); // 1
    store.trigger.redo(); // 2
    store.trigger.inc(); // 3
    store.trigger.inc(); // 4

    // History should be trimmed to last 2 snapshots
    store.trigger.undo(); // 3
    store.trigger.undo(); // 2
    store.trigger.undo(); // Should stay at 2
    expect(store.getSnapshot().context.count).toBe(2);
  });

  it('should preserve context with skipped events', () => {
    const store = createStore(
      undoRedoSnapshot(
        {
          context: { count: 0, logs: [] as string[] },
          on: {
            inc: (ctx) => ({ count: ctx.count + 1, logs: ctx.logs }),
            log: (ctx, event: { type: 'log'; message: string }) => ({
              logs: [...(ctx.logs || []), event.message],
              count: ctx.count
            })
          }
        },
        {
          skipEvent: (event) => event.type === 'log'
        }
      )
    );

    store.send({ type: 'inc' }); // count = 1
    store.send({ type: 'log', message: 'first log' }); // logs = ['first log'] (not tracked)
    store.send({ type: 'inc' }); // count = 2

    expect(store.getSnapshot().context.count).toBe(2);
    expect(store.getSnapshot().context.logs).toEqual(['first log']);

    // Undo should restore snapshot before second inc, which includes the log
    store.send({ type: 'undo' }); // count = 1, logs = ['first log']
    expect(store.getSnapshot().context.count).toBe(1);
    expect(store.getSnapshot().context.logs).toEqual(['first log']);
  });

  it('should handle transaction grouping with historyLimit', () => {
    const store = createStore(
      undoRedoSnapshot(
        {
          context: { count: 0 },
          on: {
            inc: (ctx) => ({ count: ctx.count + 1 }),
            dec: (ctx) => ({ count: ctx.count - 1 })
          }
        },
        {
          getTransactionId: (event) => event.type,
          historyLimit: 3
        }
      )
    );

    // First transaction
    store.send({ type: 'inc' }); // 1
    store.send({ type: 'inc' }); // 2

    // Second transaction
    store.send({ type: 'dec' }); // 1
    store.send({ type: 'dec' }); // 0

    // Third transaction
    store.send({ type: 'inc' }); // 1
    store.send({ type: 'inc' }); // 2

    // Undo third transaction
    store.send({ type: 'undo' }); // 0
    expect(store.getSnapshot().context.count).toBe(0);

    // Undo second transaction - only partial history available due to limit
    // The {2,dec} snapshot was trimmed, so we can only restore to {1,dec}
    store.send({ type: 'undo' }); // 1
    expect(store.getSnapshot().context.count).toBe(1);

    // Can't undo further due to limit (first transaction's snapshots were trimmed)
    store.send({ type: 'undo' }); // Should stay at 1
    expect(store.getSnapshot().context.count).toBe(1);
  });
});
