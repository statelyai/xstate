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

it('should allow listening to emitted events via addEventListener', () => {
  const store = createStore({
    context: { count: 0 },
    types: {
      emitted: {} as { type: 'incremented'; value: number }
    },
    on: {
      increment: (context, _event, { emit }) => {
        emit({ type: 'incremented', value: context.count + 1 });
        return { count: context.count + 1 };
      }
    }
  });

  const listener = jest.fn();
  store.addEventListener('incremented', ((e: CustomEvent) => {
    listener(e.detail);
  }) as EventListener);

  store.send({ type: 'increment' });

  expect(listener).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'incremented',
      value: 1
    })
  );
});

it('should allow removing event listeners', () => {
  const store = createStore({
    context: { count: 0 },
    types: {
      emitted: {} as { type: 'incremented'; value: number }
    },
    on: {
      increment: (context, _event, { emit }) => {
        emit({ type: 'incremented', value: context.count + 1 });
        return { count: context.count + 1 };
      }
    }
  });

  const listener = jest.fn();
  const handler = ((e: CustomEvent) => {
    listener(e.detail);
  }) as EventListener;

  store.addEventListener('incremented', handler);
  store.removeEventListener('incremented', handler);

  store.send({ type: 'increment' });

  expect(listener).not.toHaveBeenCalled();
});

it('should support both addEventListener and .on() simultaneously', () => {
  const store = createStore({
    context: { count: 0 },
    types: {
      emitted: {} as { type: 'incremented'; value: number }
    },
    on: {
      increment: (context, _event, { emit }) => {
        emit({ type: 'incremented', value: context.count + 1 });
        return { count: context.count + 1 };
      }
    }
  });

  const domListener = jest.fn();
  const onListener = jest.fn();

  store.addEventListener('incremented', ((e: CustomEvent) => {
    domListener(e.detail);
  }) as EventListener);

  store.on('incremented', (event) => {
    onListener(event);
  });

  store.send({ type: 'increment' });

  expect(domListener).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'incremented',
      value: 1
    })
  );
  expect(onListener).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'incremented',
      value: 1
    })
  );
});

it('should dispatch events with correct CustomEvent detail', () => {
  const store = createStore({
    context: { count: 0 },
    types: {
      emitted: {} as {
        type: 'incremented';
        value: number;
        metadata: { timestamp: number };
      }
    },
    on: {
      increment: (context, _event, { emit }) => {
        emit({
          type: 'incremented',
          value: context.count + 1,
          metadata: { timestamp: 123 }
        });
        return { count: context.count + 1 };
      }
    }
  });

  const listener = jest.fn();
  store.addEventListener('incremented', ((e: CustomEvent) => {
    listener(e.type, e.detail);
  }) as EventListener);

  store.send({ type: 'increment' });

  expect(listener).toHaveBeenCalledWith('incremented', {
    type: 'incremented',
    value: 1,
    metadata: { timestamp: 123 }
  });
});

it('should handle multiple event listeners for the same event type', () => {
  const store = createStore({
    context: { count: 0 },
    types: {
      emitted: {} as { type: 'incremented'; value: number }
    },
    on: {
      increment: (context, _event, { emit }) => {
        emit({ type: 'incremented', value: context.count + 1 });
        return { count: context.count + 1 };
      }
    }
  });

  const listener1 = jest.fn();
  const listener2 = jest.fn();

  store.addEventListener('incremented', ((e: CustomEvent) => {
    listener1(e.detail);
  }) as EventListener);
  store.addEventListener('incremented', ((e: CustomEvent) => {
    listener2(e.detail);
  }) as EventListener);

  store.send({ type: 'increment' });

  expect(listener1).toHaveBeenCalledTimes(1);
  expect(listener2).toHaveBeenCalledTimes(1);
  expect(listener1).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'incremented',
      value: 1
    })
  );
  expect(listener2).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'incremented',
      value: 1
    })
  );
});
