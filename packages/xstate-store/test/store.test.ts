import { produce } from 'immer';
import { createStore, createStoreWithProducer } from '../src/index.ts';
import { createBrowserInspector } from '@statelyai/inspect';

it('updates a store with an event without mutating original context', () => {
  const context = { count: 0 };
  const store = createStore({
    context,
    on: {
      inc: (context, event: { by: number }) => {
        return {
          count: context.count + event.by
        };
      }
    }
  });

  const initial = store.getInitialSnapshot();

  store.send({ type: 'inc', by: 1 });

  const next = store.getSnapshot();

  expect(initial.context).toEqual({ count: 0 });
  expect(next.context).toEqual({ count: 1 });
  expect(context.count).toEqual(0);
});

it('can update context', () => {
  const store = createStore({
    context: { count: 0, greeting: 'hello' },
    on: {
      inc: (ctx) => ({
        ...ctx,
        count: ctx.count + 1
      }),
      updateBoth: () => ({
        count: 42,
        greeting: 'hi'
      })
    }
  });

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
  const store = createStore({
    context: { count: 0 },
    on: {
      inc: (ctx) => ({
        count: ctx.count + 1
      })
    }
  });

  store.send({
    // @ts-expect-error
    type: 'unknown'
  });
  expect(store.getSnapshot().context).toEqual({ count: 0 });
});

it('updates state from sent events', () => {
  const store = createStore({
    context: {
      count: 0
    },
    on: {
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
  });

  store.send({ type: 'inc', by: 9 });
  store.send({ type: 'dec', by: 3 });

  expect(store.getSnapshot().context).toEqual({ count: 6 });
  store.send({ type: 'clear' });

  expect(store.getSnapshot().context).toEqual({ count: 0 });
});

it('createStoreWithProducer(…) works with an immer producer', () => {
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
  const store = createStoreWithProducer(produce, {
    context: {
      count: 0
    },
    on: {
      inc: (ctx, ev: { by: number }) => {
        ctx satisfies { count: number };
        // @ts-expect-error
        ctx satisfies { count: string };

        ctx.count += ev.by;
      }
    }
  });

  store.getSnapshot().context satisfies { count: number };
});

it('can be observed', () => {
  const store = createStore({
    context: {
      count: 0
    },
    on: {
      inc: (ctx) => ({
        count: ctx.count + 1
      })
    }
  });

  const counts: number[] = [];

  const sub = store.subscribe((s) => counts.push(s.context.count));

  expect(counts).toEqual([]);

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
  const store = createStore({
    context: {
      count: 0
    },
    on: {
      inc: (ctx) => ({
        count: ctx.count + 1
      })
    }
  });

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
    context: {
      count: 0
    },
    emits: {
      increased: (a: { upBy: number }) => {}
    },
    on: {
      inc: (ctx, _, enq) => {
        enq.emit.increased({ upBy: 1 });
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
    context: {
      count: 0
    },
    emits: {
      increased: (_: { upBy: number }) => {}
    },
    on: {
      inc: (ctx, _, enq) => {
        enq.emit.increased({ upBy: 1 });

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
    context: {
      count: 0
    },
    emits: {
      increased: (_: { upBy: number }) => {}
    },
    on: {
      inc: (ctx, _, enq) => {
        enq.emit.increased({ upBy: 1 });

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

it('effects can be enqueued', async () => {
  const store = createStore({
    context: {
      count: 0
    },
    on: {
      inc: (ctx, _, enq) => {
        enq.effect(() => {
          setTimeout(() => {
            store.send({ type: 'dec' });
          }, 5);
        });

        return {
          ...ctx,
          count: ctx.count + 1
        };
      },
      dec: (ctx) => ({
        ...ctx,
        count: ctx.count - 1
      })
    }
  });

  store.send({ type: 'inc' });

  expect(store.getSnapshot().context.count).toEqual(1);

  await new Promise((resolve) => setTimeout(resolve, 10));

  expect(store.getSnapshot().context.count).toEqual(0);
});

describe('store.trigger', () => {
  it('should allow triggering events with a fluent API', () => {
    const store = createStore({
      context: { count: 0 },
      on: {
        increment: (ctx, event: { by: number }) => ({
          count: ctx.count + event.by
        })
      }
    });

    store.trigger.increment({ by: 5 });

    expect(store.getSnapshot().context.count).toBe(5);
  });

  it('should provide type safety for event payloads', () => {
    const store = createStore({
      context: { count: 0 },
      on: {
        increment: (ctx, event: { by: number }) => ({
          count: ctx.count + event.by
        }),
        reset: () => ({ count: 0 })
      }
    });

    // @ts-expect-error - missing required 'by' property
    store.trigger.increment({});

    // @ts-expect-error - extra property not allowed
    store.trigger.increment({ by: 1, extra: true });

    // @ts-expect-error - unknown event
    store.trigger.unknown({});

    // Valid usage with no payload
    store.trigger.reset();

    // Valid usage with payload
    store.trigger.increment({ by: 1 });
  });

  it('should be equivalent to store.send', () => {
    const store = createStore({
      context: { count: 0 },
      on: {
        increment: (ctx, event: { by: number }) => ({
          count: ctx.count + event.by
        })
      }
    });

    const sendSpy = jest.spyOn(store, 'send');

    store.trigger.increment({ by: 5 });

    expect(sendSpy).toHaveBeenCalledWith({
      type: 'increment',
      by: 5
    });
  });
});

it('works with typestates', () => {
  type ContextStates =
    | {
        status: 'loading';
        data: null;
      }
    | {
        status: 'success';
        data: string;
      };

  const store = createStore({
    context: {
      status: 'loading',
      data: null
    } as ContextStates,
    on: {
      loaded: () => ({
        status: 'success' as const,
        data: 'hello'
      }),
      loading: () => ({
        status: 'loading' as const,
        data: null
      })
    }
  });

  const context = store.getSnapshot().context;

  if (context.status === 'loading') {
    context.data satisfies null;
    // @ts-expect-error
    context.data satisfies string;
  } else {
    context.status satisfies 'success';
    // @ts-expect-error
    context.status satisfies 'loading';

    context.data satisfies string;
    // @ts-expect-error
    context.data satisfies null;
  }
});

it('the emit type is not overridden by the payload', () => {
  const spy = jest.fn();
  type Context = {
    drawer?: Drawer | null;
  };

  type Drawer = {
    id: string;
  };

  const context: Context = {
    drawer: null
  };

  const drawersBridgeStore = createStore({
    emits: {
      drawerOpened: (_payload: { drawer: Drawer }) => {
        // ...
      }
    },
    context,
    on: {
      openDrawer: (context, event: { drawer: Drawer }, enqueue) => {
        enqueue.emit.drawerOpened(event);

        return {
          ...context,
          drawer: event.drawer
        };
      }
    }
  });

  drawersBridgeStore.on('drawerOpened', (event) => {
    // expect to be called here
    spy(event);
  });

  drawersBridgeStore.send({
    type: 'openDrawer',
    drawer: { id: 'a' }
  });

  expect(spy).toHaveBeenCalledWith({
    type: 'drawerOpened',
    drawer: { id: 'a' }
  });
});

it('can emit events from createStoreWithProducer', () => {
  const store = createStoreWithProducer(produce, {
    context: {
      count: 0
    },
    emits: {
      increased: (_: { by: number }) => {}
    },
    on: {
      inc: (ctx, ev: { by: number }, enq) => {
        enq.emit.increased({ by: ev.by });
        ctx.count += ev.by;
      }
    }
  });

  const spy = jest.fn();
  store.on('increased', spy);

  store.send({ type: 'inc', by: 3 });

  expect(spy).toHaveBeenCalledWith({ type: 'increased', by: 3 });
  expect(store.getSnapshot().context).toEqual({ count: 3 });
});

describe('store.transition', () => {
  it('returns next state and effects for a given state and event', () => {
    const store = createStore({
      context: { count: 0 },
      emits: {
        increased: (_: { by: number }) => {}
      },
      on: {
        inc: (ctx, event: { by: number }, enq) => {
          enq.emit.increased({ by: event.by });
          return {
            count: ctx.count + event.by
          };
        }
      }
    });

    const [nextState, effects] = store.transition(store.getSnapshot(), {
      type: 'inc',
      by: 2
    });

    expect(nextState.context).toEqual({ count: 2 });
    expect(effects).toHaveLength(1);
    expect(effects[0]).toEqual({ type: 'increased', by: 2 });
  });

  it('returns unchanged state and empty effects for unknown events', () => {
    const store = createStore({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({
          count: ctx.count + 1
        })
      }
    });

    const currentState = store.getSnapshot();
    const [nextState, effects] = store.transition(currentState, {
      // @ts-expect-error
      type: 'unknown'
    });

    expect(nextState).toBe(currentState);
    expect(effects).toEqual([]);
  });

  it('works with producer functions', () => {
    const store = createStoreWithProducer(produce, {
      context: { count: 0 },
      emits: {
        increased: (_: { by: number }) => {}
      },
      on: {
        inc: (ctx, event: { by: number }, enq) => {
          enq.emit.increased({ by: event.by });
          ctx.count += event.by;
        }
      }
    });

    const [nextState, effects] = store.transition(store.getSnapshot(), {
      type: 'inc',
      by: 3
    });

    expect(nextState.context).toEqual({ count: 3 });
    expect(effects).toHaveLength(1);
    expect(effects[0]).toEqual({ type: 'increased', by: 3 });
  });

  it('collects enqueued effects', () => {
    const store = createStore({
      context: { count: 0 },
      on: {
        inc: (ctx, _, enq) => {
          enq.effect(() => {
            // This effect function would normally do something
          });
          return {
            count: ctx.count + 1
          };
        }
      }
    });

    const [nextState, effects] = store.transition(store.getSnapshot(), {
      type: 'inc'
    });

    expect(nextState.context).toEqual({ count: 1 });
    expect(effects).toHaveLength(1);
    expect(typeof effects[0]).toBe('function');
  });
});
