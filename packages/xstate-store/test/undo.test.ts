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
  store.trigger.inc();
  store.trigger.inc();
  expect(store.getSnapshot().context.count).toBe(2);

  // Second transaction
  store.trigger.dec();
  store.trigger.dec();
  expect(store.getSnapshot().context.count).toBe(0);

  // Undo second transaction (both decrements)
  store.trigger.undo();
  expect(store.getSnapshot().context.count).toBe(2);

  // Undo first transaction (both increments)
  store.trigger.undo();
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
  store.trigger.dec(); // 0
  expect(store.getSnapshot().context.count).toBe(0);
  store.trigger.undo(); // 1
  expect(store.getSnapshot().context.count).toBe(1);
  store.trigger.redo(); // 0
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
  store.trigger.undo();
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
  store.trigger.redo();
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

  store.trigger.inc(); // 1
  expect(store.getSnapshot().context.count).toBe(1);
  store.trigger.inc(); // 2
  expect(store.getSnapshot().context.count).toBe(2);
  store.trigger.undo(); // 1
  expect(store.getSnapshot().context.count).toBe(1);
  store.trigger.dec(); // 0

  // Redo should not work as we added a new event after undo
  store.trigger.redo();
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

  store.trigger.inc();
  store.trigger.undo();
  store.trigger.redo();

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
  store.trigger.inc();
  store.trigger.undo();
  store.trigger.redo();

  // @ts-expect-error
  store.getSnapshot().context.foo;

  // @ts-expect-error
  store.trigger.dec();
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

  store.trigger.inc(); // count = 1
  store.trigger.log(); // count = 1 (logged but not undoable)
  store.trigger.inc(); // count = 2
  expect(store.getSnapshot().context.count).toBe(2);

  store.trigger.undo(); // count = 1 (skips log event)
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

  store.trigger.inc(); // count = 1
  store.trigger.log(); // count = 1 (logged but not redoable)
  store.trigger.inc(); // count = 2
  store.trigger.undo(); // count = 1
  expect(store.getSnapshot().context.count).toBe(1);

  store.trigger.redo(); // count = 2 (skips log event)
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
  store.trigger.inc(); // count = 1
  store.trigger.inc(); // count = 2
  expect(store.getSnapshot().context.count).toBe(2);

  // Log events (not a transaction because they're skipped)
  store.trigger.log(); // count = 2 (logged but not undoable)
  store.trigger.log(); // count = 2 (logged but not undoable)
  expect(store.getSnapshot().context.count).toBe(2);

  // Second transaction: inc events
  store.trigger.inc(); // count = 3
  store.trigger.inc(); // count = 4
  expect(store.getSnapshot().context.count).toBe(4);

  // Undo second transaction (all inc events)
  store.trigger.undo(); // count = 0
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

  store.trigger.inc(); // count = 1
  store.trigger.log({ message: 'first log' }); // logs = ['first log'] (not stored in history)
  store.trigger.inc(); // count = 2
  store.trigger.log({ message: 'second log' }); // logs = ['first log', 'second log'] (not stored in history)
  store.trigger.inc(); // count = 3

  expect(store.getSnapshot().context.count).toBe(3);
  expect(store.getSnapshot().context.logs).toEqual(['first log', 'second log']);

  // Undo should skip log events (they're not in history) but still undo inc events
  // Since log events are skipped, they're not replayed during undo, so logs are lost
  store.trigger.undo(); // count = 2, logs = [] (logs lost because not replayed)
  expect(store.getSnapshot().context.count).toBe(2);
  expect(store.getSnapshot().context.logs).toEqual([]);

  store.trigger.undo(); // count = 1, logs = [] (logs lost because not replayed)
  expect(store.getSnapshot().context.count).toBe(1);
  expect(store.getSnapshot().context.logs).toEqual([]);

  store.trigger.undo(); // count = 0, logs = [] (logs lost because not replayed)
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
          inc: (ctx, _: Events & { type: 'inc' }, enq) => {
            enq.emit.changed({ value: ctx.count + 1 });
            return { count: ctx.count + 1 };
          },
          log: (ctx, event: Events & { type: 'log' }, enq) => {
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

  store.trigger.inc(); // count = 1, emits changed(1)
  store.trigger.log({ message: 'test log' }); // emits logged('test log') but not stored in history
  store.trigger.inc(); // count = 2, emits changed(2)

  expect(emittedEvents).toEqual([
    { type: 'changed', value: 1 },
    { type: 'logged', message: 'test log' },
    { type: 'changed', value: 2 }
  ]);

  emittedEvents.length = 0;
  store.trigger.undo(); // count = 1
  store.trigger.undo(); // count = 0
  store.trigger.redo(); // count = 1, emits changed(1)
  store.trigger.redo(); // count = 2, emits changed(2)

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

  store.trigger.inc(); // count = 1
  store.trigger.transactionIdUpdated({ id: '1' });
  store.trigger.inc();
  store.trigger.inc();
  store.trigger.inc(); // count = 4
  store.trigger.transactionIdUpdated({ id: '2' });
  store.trigger.inc();
  store.trigger.inc();
  store.trigger.inc(); // count = 7

  store.trigger.undo();
  expect(store.getSnapshot().context.count).toBe(4);
  store.trigger.undo();
  expect(store.getSnapshot().context.count).toBe(1);
  store.trigger.redo();
  expect(store.getSnapshot().context.count).toBe(4);
  store.trigger.redo();
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

  store.trigger.inc(); // count = 1
  store.trigger.inc(); // count = 2
  store.trigger.inc(); // count = 3
  store.trigger.inc(); // count = 4 (skipped)
  expect(store.getSnapshot().context.count).toBe(4);
  store.trigger.undo(); // count = 2
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

describe('undoRedo with snapshot strategy', () => {
  it('should undo a single event', () => {
    const store = createStore(
      undoRedo(
        {
          context: { count: 0 },
          on: {
            inc: (ctx) => ({ count: ctx.count + 1 })
          }
        },
        { strategy: 'snapshot' }
      )
    );

    store.trigger.inc();
    expect(store.getSnapshot().context.count).toBe(1);

    store.trigger.undo();
    expect(store.getSnapshot().context.count).toBe(0);
  });

  it('should redo a previously undone event', () => {
    const store = createStore(
      undoRedo(
        {
          context: { count: 0 },
          on: {
            inc: (ctx) => ({ count: ctx.count + 1 })
          }
        },
        { strategy: 'snapshot' }
      )
    );

    store.trigger.inc();
    store.trigger.undo();
    store.trigger.redo();
    expect(store.getSnapshot().context.count).toBe(1);
  });

  it('should undo/redo multiple events, non-transactional', () => {
    const store = createStore(
      undoRedo(
        {
          context: { count: 0 },
          on: {
            inc: (ctx) => ({ count: ctx.count + 1 })
          }
        },
        { strategy: 'snapshot' }
      )
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
          strategy: 'snapshot',
          getTransactionId: (event) => {
            return event.type;
          }
        }
      )
    );

    // First transaction
    store.trigger.inc();
    store.trigger.inc();
    expect(store.getSnapshot().context.count).toBe(2);

    // Second transaction
    store.trigger.dec();
    store.trigger.dec();
    expect(store.getSnapshot().context.count).toBe(0);

    // Undo second transaction (both decrements)
    store.trigger.undo();
    expect(store.getSnapshot().context.count).toBe(2);

    // Undo first transaction (both increments)
    store.trigger.undo();
    expect(store.getSnapshot().context.count).toBe(0);
  });

  it('should maintain correct state when interleaving undo/redo with new events', () => {
    const store = createStore(
      undoRedo(
        {
          context: { count: 0 },
          on: {
            inc: (ctx) => ({ count: ctx.count + 1 }),
            dec: (ctx) => ({ count: ctx.count - 1 })
          }
        },
        { strategy: 'snapshot' }
      )
    );

    store.trigger.inc(); // 1
    expect(store.getSnapshot().context.count).toBe(1);
    store.trigger.inc(); // 2
    expect(store.getSnapshot().context.count).toBe(2);
    store.trigger.undo(); // 1
    expect(store.getSnapshot().context.count).toBe(1);
    store.trigger.dec(); // 0
    expect(store.getSnapshot().context.count).toBe(0);
    store.trigger.undo(); // 1
    expect(store.getSnapshot().context.count).toBe(1);
    store.trigger.redo(); // 0
    expect(store.getSnapshot().context.count).toBe(0);

    expect(store.getSnapshot().context.count).toBe(0);
  });

  it('should do nothing when undoing with empty history', () => {
    const store = createStore(
      undoRedo(
        {
          context: { count: 0 },
          on: {
            inc: (ctx) => ({ count: ctx.count + 1 })
          }
        },
        { strategy: 'snapshot' }
      )
    );

    const initialSnapshot = store.getSnapshot();
    store.trigger.undo();
    expect(store.getSnapshot().context).toEqual(initialSnapshot.context);
  });

  it('should do nothing when redoing with empty future stack', () => {
    const store = createStore(
      undoRedo(
        {
          context: { count: 0 },
          on: {
            inc: (ctx) => ({ count: ctx.count + 1 })
          }
        },
        { strategy: 'snapshot' }
      )
    );

    const initialSnapshot = store.getSnapshot();
    store.trigger.redo();
    expect(store.getSnapshot().context).toEqual(initialSnapshot.context);
  });

  it('should clear redo stack when new events occur after undo', () => {
    const store = createStore(
      undoRedo(
        {
          context: { count: 0 },
          on: {
            inc: (ctx) => ({ count: ctx.count + 1 }),
            dec: (ctx) => ({ count: ctx.count - 1 })
          }
        },
        { strategy: 'snapshot' }
      )
    );

    store.trigger.inc(); // 1
    expect(store.getSnapshot().context.count).toBe(1);
    store.trigger.inc(); // 2
    expect(store.getSnapshot().context.count).toBe(2);
    store.trigger.undo(); // 1
    expect(store.getSnapshot().context.count).toBe(1);
    store.trigger.dec(); // 0

    // Redo should not work as we added a new event after undo
    store.trigger.redo();
    expect(store.getSnapshot().context.count).toBe(0);
  });

  it('should skip non-undoable events', () => {
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
          strategy: 'snapshot',
          skipEvent: (event) => event.type === 'log'
        }
      )
    );

    store.trigger.inc(); // count = 1
    store.trigger.log(); // count = 1 (logged but not tracked)
    store.trigger.inc(); // count = 2
    expect(store.getSnapshot().context.count).toBe(2);

    store.trigger.undo(); // count = 1 (skips log event)
    expect(store.getSnapshot().context.count).toBe(1);
  });

  it('should respect historyLimit', () => {
    const store = createStore(
      undoRedo(
        {
          context: { count: 0 },
          on: {
            inc: (ctx) => ({ count: ctx.count + 1 })
          }
        },
        {
          strategy: 'snapshot',
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
      undoRedo(
        {
          context: { count: 0 },
          on: {
            inc: (ctx) => ({ count: ctx.count + 1 })
          }
        },
        {
          strategy: 'snapshot',
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
          strategy: 'snapshot',
          skipEvent: (event) => event.type === 'log'
        }
      )
    );

    store.trigger.inc(); // count = 1
    store.trigger.log({ message: 'first log' }); // logs = ['first log'] (not tracked)
    store.trigger.inc(); // count = 2

    expect(store.getSnapshot().context.count).toBe(2);
    expect(store.getSnapshot().context.logs).toEqual(['first log']);

    // Undo should restore snapshot before second inc, which includes the log
    store.trigger.undo(); // count = 1, logs = ['first log']
    expect(store.getSnapshot().context.count).toBe(1);
    expect(store.getSnapshot().context.logs).toEqual(['first log']);
  });

  it('should handle transaction grouping with historyLimit', () => {
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
          strategy: 'snapshot',
          getTransactionId: (event) => event.type,
          historyLimit: 3
        }
      )
    );

    // First transaction
    store.trigger.inc(); // 1
    store.trigger.inc(); // 2

    // Second transaction
    store.trigger.dec(); // 1
    store.trigger.dec(); // 0

    // Third transaction
    store.trigger.inc(); // 1
    store.trigger.inc(); // 2

    // Undo third transaction
    store.trigger.undo(); // 0
    expect(store.getSnapshot().context.count).toBe(0);

    // Undo second transaction - only partial history available due to limit
    // The {2,dec} snapshot was trimmed, so we can only restore to {1,dec}
    store.trigger.undo(); // 1
    expect(store.getSnapshot().context.count).toBe(1);

    // Can't undo further due to limit (first transaction's snapshots were trimmed)
    store.trigger.undo(); // Should stay at 1
    expect(store.getSnapshot().context.count).toBe(1);
  });

  it('should use compare function to skip duplicate snapshots', () => {
    const store = createStore(
      undoRedo(
        {
          context: { count: 0 },
          on: {
            inc: (ctx) => ({ count: ctx.count + 1 }),
            noop: (ctx) => ctx
          }
        },
        {
          strategy: 'snapshot',
          compare: (past, current) =>
            past.context.count === current.context.count
        }
      )
    );

    store.trigger.inc(); // count = 1
    store.trigger.noop(); // count = 1 (duplicate, not saved)
    store.trigger.noop(); // count = 1 (duplicate, not saved)
    store.trigger.inc(); // count = 2

    // Should only have 2 snapshots in history (0 and 1), not 4
    store.trigger.undo(); // count = 1
    expect(store.getSnapshot().context.count).toBe(1);
    store.trigger.undo(); // count = 0
    expect(store.getSnapshot().context.count).toBe(0);
    store.trigger.undo(); // Should stay at 0
    expect(store.getSnapshot().context.count).toBe(0);
  });

  it('should save all snapshots when no compare function is provided', () => {
    const store = createStore(
      undoRedo(
        {
          context: { count: 0 },
          on: {
            inc: (ctx) => ({ count: ctx.count + 1 }),
            noop: (ctx) => ctx
          }
        },
        { strategy: 'snapshot' }
      )
    );

    store.trigger.inc(); // count = 1
    store.trigger.noop(); // count = 1 (saved even though duplicate)
    store.trigger.noop(); // count = 1 (saved even though duplicate)
    store.trigger.inc(); // count = 2

    // Should have 4 snapshots in history (0, 1, 1, 1)
    store.trigger.undo(); // count = 1
    expect(store.getSnapshot().context.count).toBe(1);
    store.trigger.undo(); // count = 1
    expect(store.getSnapshot().context.count).toBe(1);
    store.trigger.undo(); // count = 1
    expect(store.getSnapshot().context.count).toBe(1);
    store.trigger.undo(); // count = 0
    expect(store.getSnapshot().context.count).toBe(0);
  });
});
