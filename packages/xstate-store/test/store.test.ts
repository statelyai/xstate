import {
  createAsyncStore,
  createStore,
  createStoreConfig
} from '../src/index.ts';
import { createStoreTransition } from '../src/store.ts';
import { reset } from '../src/reset.ts';
import { createBrowserInspector } from '@statelyai/inspect';
import { schema } from './schema.ts';
import {
  AnyStoreConfig,
  ContextFromStoreConfig,
  EventFromStoreConfig
} from '../src/types.ts';

it('updates a store with an event without mutating original context', () => {
  const context = { count: 0 };
  const store = createAsyncStore({
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

  store.trigger.inc({
    by: 1
  });

  const next = store.getSnapshot();

  expect(initial.context).toEqual({ count: 0 });
  expect(next.context).toEqual({ count: 1 });
  expect(context.count).toEqual(0);
});

it('can update context', () => {
  const store = createAsyncStore({
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

  store.trigger.inc();
  expect(store.getSnapshot().context).toEqual({ count: 1, greeting: 'hello' });

  store.trigger.updateBoth();
  expect(store.getSnapshot().context).toEqual({ count: 42, greeting: 'hi' });
});

it('handles unknown events sent via store.send (does not do anything)', () => {
  const store = createAsyncStore({
    context: { count: 0 },
    on: {
      inc: (ctx) => ({
        count: ctx.count + 1
      })
    }
  });

  store.send({ type: 'unknown' } as any);
  expect(store.getSnapshot().context).toEqual({ count: 0 });
});

it('updates state from sent events', () => {
  const store = createAsyncStore({
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

  store.trigger.inc({
    by: 9
  });
  store.trigger.dec({
    by: 3
  });

  expect(store.getSnapshot().context).toEqual({ count: 6 });
  store.trigger.clear();

  expect(store.getSnapshot().context).toEqual({ count: 0 });
});

it('can be observed', () => {
  const store = createAsyncStore({
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

  store.trigger.inc(); // 1
  store.trigger.inc(); // 2
  store.trigger.inc(); // 3

  expect(counts).toEqual([1, 2, 3]);

  sub.unsubscribe();

  store.trigger.inc(); // 4
  store.trigger.inc(); // 5
  store.trigger.inc(); // 6

  expect(counts).toEqual([1, 2, 3]);
});

it('does not expose atom internals at runtime', () => {
  const store = createAsyncStore({
    context: { count: 0 },
    on: {}
  });

  expect('_snapshot' in store).toBe(false);
});

it('can be inspected', () => {
  const store = createAsyncStore({
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

  store.trigger.inc();

  expect(evs).toEqual([
    expect.objectContaining({
      type: '@xstate.transition',
      event: { type: '@xstate.init' },
      snapshot: expect.objectContaining({ context: { count: 0 } })
    }),
    expect.objectContaining({
      type: '@xstate.transition',
      event: { type: 'inc' },
      snapshot: expect.objectContaining({ context: { count: 1 } })
    })
  ]);
});

it('inspection with @statelyai/inspect typechecks correctly', () => {
  const store = createAsyncStore({
    context: {},
    on: {}
  });

  const inspector = createBrowserInspector({
    autoStart: false
  });

  store.inspect(inspector.inspect);
});

it('emitted events can be subscribed to', () => {
  const store = createAsyncStore({
    context: {
      count: 0
    },
    schemas: {
      emitted: {
        increased: schema<{ upBy: number }>()
      }
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

  const spy = vi.fn();

  store.on('increased', spy);

  store.trigger.inc();

  expect(spy).toHaveBeenCalledWith({ type: 'increased', upBy: 1 });
});

it('emitted events can be unsubscribed to', () => {
  const store = createAsyncStore({
    context: {
      count: 0
    },
    schemas: {
      emitted: {
        increased: schema<{ upBy: number }>()
      }
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

  const spy = vi.fn();
  const sub = store.on('increased', spy);
  store.trigger.inc();

  expect(spy).toHaveBeenCalledWith({ type: 'increased', upBy: 1 });

  sub.unsubscribe();
  store.trigger.inc();

  expect(spy).toHaveBeenCalledTimes(1);
});

it('emitted events occur after the snapshot is updated', () => {
  const store = createAsyncStore({
    context: {
      count: 0
    },
    schemas: {
      emitted: {
        increased: schema<{ upBy: number }>()
      }
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

  store.trigger.inc();
});

it('events can be emitted with no payload', () => {
  const spy = vi.fn();

  const store = createAsyncStore({
    schemas: {
      emitted: {
        incremented: schema<{}>(),
        decremented: schema<{}>(),
        expectsPayload: schema<{ payload: string }>()
      }
    },
    context: {
      count: 0
    },
    on: {
      inc: (_ctx, _ev, enq) => {
        enq.emit.incremented();
        enq.emit.incremented(
          // @ts-expect-error
          'foo'
        );
      },
      dec: (_ctx, _ev, enq) => {
        enq.emit.decremented(
          // @ts-expect-error No payload expected
          {}
        );
      },
      hasPayload: (_ctx, _ev, enq) => {
        enq.emit
          // @ts-expect-error Payload expected
          .expectsPayload();
      }
    }
  });

  store.on('incremented', spy);

  store.trigger.inc();

  expect(spy).toHaveBeenCalledWith({ type: 'incremented' });
});

it('events can be emitted with optional payloads (type check)', () => {
  createStore({
    schemas: {
      emitted: {
        optionalPayload: schema<{ payload?: string }>()
      }
    },
    context: {},
    on: {
      inc: (_ctx, _ev, enq) => {
        enq.emit.optionalPayload();

        enq.emit.optionalPayload({ payload: 'hello' });

        enq.emit.optionalPayload({});

        enq.emit.optionalPayload(
          // @ts-expect-error
          'foo'
        );
      }
    }
  });
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
            store.trigger.dec();
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

  store.trigger.inc();

  expect(store.getSnapshot().context.count).toEqual(1);

  await new Promise((resolve) => setTimeout(resolve, 10));

  expect(store.getSnapshot().context.count).toEqual(0);
});

it('effect-only transitions should execute effects', () => {
  const spy = vi.fn();
  const store = createStore({
    context: { count: 0 },
    on: {
      justEffect: (ctx, _, enq) => {
        enq.effect(spy);
      }
    }
  });

  store.trigger.justEffect();

  expect(spy).toHaveBeenCalledTimes(1);
});

it('emits-only transitions should emit events', () => {
  const spy = vi.fn();
  const store = createStore({
    context: { count: 0 },
    schemas: {
      emitted: {
        emitted: schema<{}>()
      }
    },
    on: {
      justEmit: (ctx, _, enq) => {
        enq.emit.emitted();
      }
    }
  });

  store.on('emitted', spy);

  store.trigger.justEmit();

  expect(spy).toHaveBeenCalledTimes(1);
});

it('wildcard listener receives all emitted events', () => {
  const spy = vi.fn();
  const store = createStore({
    context: { count: 0 },
    schemas: {
      emitted: {
        increased: schema<{ upBy: number }>(),
        decreased: schema<{ downBy: number }>()
      }
    },
    on: {
      inc: (ctx, _, enq) => {
        enq.emit.increased({ upBy: 1 });
        return { ...ctx, count: ctx.count + 1 };
      },
      dec: (ctx, _, enq) => {
        enq.emit.decreased({ downBy: 1 });
        return { ...ctx, count: ctx.count - 1 };
      }
    }
  });

  store.on('*', spy);

  store.trigger.inc();
  expect(spy).toHaveBeenCalledWith({ type: 'increased', upBy: 1 });

  store.trigger.dec();
  expect(spy).toHaveBeenCalledWith({ type: 'decreased', downBy: 1 });

  expect(spy).toHaveBeenCalledTimes(2);
});

it('wildcard listener can be unsubscribed', () => {
  const spy = vi.fn();
  const store = createStore({
    context: { count: 0 },
    schemas: {
      emitted: {
        increased: schema<{ upBy: number }>()
      }
    },
    on: {
      inc: (ctx, _, enq) => {
        enq.emit.increased({ upBy: 1 });
        return { ...ctx, count: ctx.count + 1 };
      }
    }
  });

  const sub = store.on('*', spy);
  store.trigger.inc();
  expect(spy).toHaveBeenCalledTimes(1);

  sub.unsubscribe();
  store.trigger.inc();
  expect(spy).toHaveBeenCalledTimes(1);
});

it('wildcard listener is called after specific listener', () => {
  const order: string[] = [];
  const store = createStore({
    context: { count: 0 },
    schemas: {
      emitted: {
        increased: schema<{ upBy: number }>()
      }
    },
    on: {
      inc: (ctx, _, enq) => {
        enq.emit.increased({ upBy: 1 });
        return { ...ctx, count: ctx.count + 1 };
      }
    }
  });

  store.on('increased', () => order.push('specific'));
  store.on('*', () => order.push('wildcard'));

  store.trigger.inc();

  expect(order).toEqual(['specific', 'wildcard']);
});

it('async steps can be enqueued', async () => {
  const store = createStore({
    context: {
      count: 0
    },
    on: {
      inc: (ctx, _, enq) => {
        enq.effect(async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          store.trigger.dec();
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

  store.trigger.inc();

  expect(store.getSnapshot().context.count).toEqual(1);

  await new Promise((resolve) => setTimeout(resolve, 10));

  expect(store.getSnapshot().context.count).toEqual(0);
});

it('supports async step-based transition handlers', async () => {
  const order: string[] = [];
  const stepSpy = vi.fn(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    return 42;
  });
  const store = createAsyncStore({
    context: {
      result: undefined as number | undefined
    },
    schemas: {
      emitted: {
        loaded: schema<{ result: number }>()
      }
    },
    on: {
      load: async (_ctx, _event, enq) => {
        enq.effect(() => {
          order.push('before');
        });

        const result = await enq.step('fetchResult', stepSpy);

        enq.effect(() => {
          order.push('after');
        });
        enq.emit.loaded({ result });

        return { result };
      }
    }
  });
  const loadedSpy = vi.fn();

  store.on('loaded', loadedSpy);
  store.trigger.load();

  expect(store.getSnapshot().context.result).toBeUndefined();
  expect(Object.values(store.getSnapshot().async!)[0].steps).toMatchObject({
    async: { status: 'active' },
    fetchResult: { status: 'active' }
  });
  expect(order).toEqual([]);
  expect(stepSpy).toHaveBeenCalledTimes(1);

  await new Promise((resolve) => setTimeout(resolve, 10));

  expect(store.getSnapshot().context.result).toBe(42);
  expect(store.getSnapshot().async ?? {}).toEqual({});
  expect(order).toEqual(['before', 'after']);
  expect(loadedSpy).toHaveBeenCalledWith({ type: 'loaded', result: 42 });
});

it('replays sequential async steps and updates pending metadata', async () => {
  let resolveFirst!: (value: number) => void;
  let resolveSecond!: (value: number) => void;
  const firstPromise = new Promise<number>((resolve) => {
    resolveFirst = resolve;
  });
  const secondPromise = new Promise<number>((resolve) => {
    resolveSecond = resolve;
  });
  const store = createAsyncStore({
    context: {
      result: 0
    },
    on: {
      load: async (ctx, _event, enq) => {
        const first = await enq.step('first', () => firstPromise);
        const second = await enq.step('second', () => secondPromise);

        return {
          result: ctx.result + first + second
        };
      }
    }
  });

  store.trigger.load();

  expect(Object.values(store.getSnapshot().async!)[0].steps).toMatchObject({
    async: { status: 'active' },
    first: { status: 'active' }
  });

  resolveFirst(2);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(Object.values(store.getSnapshot().async!)[0].steps).toMatchObject({
    async: { status: 'active' },
    first: { status: 'done', output: 2 },
    second: { status: 'active' }
  });

  resolveSecond(3);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(store.getSnapshot().async ?? {}).toEqual({});
  expect(store.getSnapshot().context.result).toBe(5);
});

it('reuses resolved async step values when the same step id is awaited again', async () => {
  const stepSpy = vi.fn(async () => 5);
  const store = createAsyncStore({
    context: {
      result: 0
    },
    on: {
      load: async (ctx, _event, enq) => {
        const first = await enq.step('same', stepSpy);
        const second = await enq.step('same', stepSpy);

        return {
          result: ctx.result + first + second
        };
      }
    }
  });

  store.trigger.load();
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(stepSpy).toHaveBeenCalledTimes(1);
  expect(store.getSnapshot().context.result).toBe(10);
  expect(store.getSnapshot().async ?? {}).toEqual({});
});

it('replays async transitions against the latest snapshot context', async () => {
  let resolveStep!: (value: number) => void;
  const stepPromise = new Promise<number>((resolve) => {
    resolveStep = resolve;
  });
  const store = createAsyncStore({
    context: {
      count: 0,
      result: 0
    },
    on: {
      load: async (ctx, _event, enq) => {
        const result = await enq.step('fetchResult', () => stepPromise);

        return {
          ...ctx,
          count: ctx.count + 1,
          result
        };
      },
      inc: (ctx) => ({
        ...ctx,
        count: ctx.count + 1
      })
    }
  });

  store.trigger.load();
  store.trigger.inc();
  resolveStep(7);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(store.getSnapshot().context).toEqual({
    count: 2,
    result: 7
  });
});

it('can resume an in-progress async transition from a persisted snapshot', async () => {
  const config = {
    context: {
      count: 0,
      result: 0
    },
    on: {
      load: async (
        ctx: { count: number; result: number },
        event: { value: number },
        enq: any
      ) => {
        const result = await enq.step('fetchResult', async () => event.value);

        return {
          count: ctx.count + 1,
          result
        };
      }
    }
  };
  const store = createAsyncStore(config);

  store.trigger.load({ value: 7 });

  const persistedSnapshot = JSON.parse(JSON.stringify(store.getSnapshot()));
  const executionId = Object.keys(persistedSnapshot.async)[0];

  expect(persistedSnapshot.async[executionId]).toMatchObject({
    event: { type: 'load', value: 7 },
    steps: {
      async: { status: 'active' },
      fetchResult: { status: 'active' }
    }
  });

  const restoredStore = createAsyncStore({
    ...config,
    snapshot: persistedSnapshot
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(restoredStore.getSnapshot().context).toEqual({
    count: 1,
    result: 7
  });
  expect(restoredStore.getSnapshot().async).toEqual({});
});

it('rejects async handlers that do not await enq.step(...)', () => {
  const store = createAsyncStore({
    context: {
      count: 0
    },
    on: {
      bad: async (ctx) => ({
        count: ctx.count + 1
      })
    }
  });

  expect(() => store.trigger.bad()).toThrow(
    'Async transition must await enq.step(...)'
  );
  expect(store.getSnapshot().context.count).toBe(0);
  expect(store.getSnapshot().async ?? {}).toEqual({});
});

it('rejects async handlers in createStoreTransition(...)', () => {
  const store = createStore({
    context: { count: 0 },
    on: {}
  });
  const transition = store.transition;

  expect(() =>
    transition(store.getSnapshot(), {
      type: 'bad'
    } as any)
  ).not.toThrow();

  const unsupportedTransition = createStoreTransition({
    bad: (async (ctx: { count: number }) => ({
      count: ctx.count + 1
    })) as any
  });

  expect(() =>
    unsupportedTransition(
      {
        context: { count: 0 },
        status: 'active',
        output: undefined,
        error: undefined
      },
      { type: 'bad' }
    )
  ).toThrow('Async transition unsupported here');
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

    if (false) {
      // @ts-expect-error - missing required 'by' property
      store.trigger.increment({});

      // @ts-expect-error - extra property not allowed
      store.trigger.increment({ by: 1, extra: true });

      // @ts-expect-error - unknown event
      store.trigger.unknown({});
    }

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

    const sendSpy = vi.spyOn(store, 'send');

    store.trigger.increment({ by: 5 });

    expect(sendSpy).toHaveBeenCalledWith({
      type: 'increment',
      by: 5
    });
  });

  it('should fail fast for unknown trigger names on config-based stores', () => {
    const store = createStore({
      context: { count: 0 },
      on: {
        increment: (ctx, event: { by: number }) => ({
          count: ctx.count + event.by
        }),
        reset: () => ({ count: 0 })
      }
    });

    expect(Object.keys(store.trigger)).toEqual(['increment', 'reset']);
    expect(() => (store.trigger as any).unknown()).toThrow(TypeError);
    expect(store.getSnapshot().context.count).toBe(0);
  });

  it('should include extension events in the concrete trigger object', () => {
    const store = createStore({
      context: { count: 0 },
      on: {
        increment: (ctx, event: { by: number }) => ({
          count: ctx.count + event.by
        })
      }
    }).with(reset());

    expect(Object.keys(store.trigger)).toEqual(['increment', 'reset']);

    store.trigger.increment({ by: 2 });
    store.trigger.reset();

    expect(store.getSnapshot().context.count).toBe(0);
  });

  it('should include schema-declared events in the concrete trigger object', () => {
    const store = createStore({
      schemas: {
        events: {
          increment: schema<{ by: number }>(),
          reset: schema<{}>()
        }
      },
      context: { count: 0 },
      on: {
        increment: (ctx, event) => ({
          count: ctx.count + event.by
        })
      }
    });

    expect(Object.keys(store.trigger)).toEqual(['increment', 'reset']);

    store.trigger.increment({ by: 2 });
    store.trigger.reset();

    expect(store.getSnapshot().context.count).toBe(2);
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
  const spy = vi.fn();
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
    schemas: {
      emitted: {
        drawerOpened: schema<{ drawer: Drawer }>()
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

  drawersBridgeStore.trigger.openDrawer({
    drawer: { id: 'a' }
  });

  expect(spy).toHaveBeenCalledWith({
    type: 'drawerOpened',
    drawer: { id: 'a' }
  });
});

describe('store.transition', () => {
  it('returns next state and effects for a given state and event', () => {
    const store = createStore({
      context: { count: 0 },
      schemas: {
        emitted: {
          increased: schema<{ by: number }>(),
          nothing: schema<{}>()
        }
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

it('can be created with a logic object', () => {
  const store = createStore({
    getInitialSnapshot: () => ({
      context: { count: 0 },
      status: 'active' as const,
      output: undefined,
      error: undefined
    }),
    transition: (
      snapshot,
      event: {
        type: 'inc';
      }
    ) => {
      if (event.type === 'inc') {
        return [
          { ...snapshot, context: { count: snapshot.context.count + 1 } },
          []
        ];
      }
      return [snapshot, []];
    }
  });

  expect(store.getSnapshot().context).toEqual({ count: 0 });

  store.trigger.inc();

  expect(store.getSnapshot().context).toEqual({ count: 1 });

  // @ts-expect-error
  store.trigger.unknown();

  store.getSnapshot().context.count satisfies number;

  // @ts-expect-error
  store.getSnapshot().context.count satisfies string;
});

it('should not trigger update if the snapshot is the same', () => {
  const store = createStore({
    context: { count: 0 },
    on: {
      doNothing: (ctx) => ctx
    }
  });

  const spy = vi.fn();
  store.subscribe(spy);

  store.trigger.doNothing();
  store.trigger.doNothing();

  expect(spy).toHaveBeenCalledTimes(0);
});

it('should not trigger update if the snapshot is the same even if there are effects', () => {
  const store = createStore({
    context: { count: 0 },
    on: {
      doNothing: (ctx, _, enq) => {
        enq.effect(() => {
          // …
        });
        return ctx;
      }
    }
  });

  const spy = vi.fn();
  store.subscribe(spy);

  store.trigger.doNothing();
  store.trigger.doNothing();

  expect(spy).toHaveBeenCalledTimes(0);
});

describe('types', () => {
  it('AnyStoreConfig', () => {
    function transformStoreConfig(_config: AnyStoreConfig): void {}

    transformStoreConfig({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      }
    });

    // @ts-expect-error
    transformStoreConfig({});
  });

  it('EventFromStoreConfig', () => {
    const storeConfig = createStoreConfig({
      context: { count: 0 },
      on: {
        inc: (ctx, event: { by: number }) => ({ count: ctx.count + event.by })
      }
    });

    let ev: EventFromStoreConfig<typeof storeConfig> = {
      type: 'inc',
      by: 1
    };

    ev satisfies {
      type: 'inc';
      by: number;
    };

    // @ts-expect-error
    ev satisfies { type: 'unknown' };
  });

  it('ContextFromStoreConfig', () => {
    const storeConfig = createStoreConfig({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      }
    });

    type Context = ContextFromStoreConfig<typeof storeConfig>;

    const context: Context = { count: 0 };

    context.count satisfies number;

    // @ts-expect-error
    context.count satisfies string;
  });

  it('generics can be provided', () => {
    type Context = {
      coffeeBeans: number;
      water: number;
    };

    type Events =
      | {
          type: 'addWater';
          amount: number;
        }
      | {
          type: 'grindBeans';
        };

    type Emitted =
      | { type: 'brewing' }
      | { type: 'beansGround'; amount: number };

    const store = createStore<Context, Events, Emitted>({
      context: {
        coffeeBeans: 0,
        water: 0
      },
      on: {
        addWater: (ctx, event) => ({
          ...ctx,
          water: ctx.water + event.amount
        }),
        grindBeans: (ctx, _, enq) => {
          enq.emit.brewing();

          enq.emit.beansGround({ amount: 1 });

          // @ts-expect-error
          enq.emit.beansGround();

          // @ts-expect-error
          enq.emit.brewing({ foo: 'bar' });

          return {
            ...ctx,
            coffeeBeans: ctx.coffeeBeans + 1
          };
        }
      }
    });

    store.trigger.addWater({ amount: 1 });

    store.trigger.grindBeans();

    if (false) {
      // @ts-expect-error
      store.trigger.unknown();
    }
  });

  it('localizes TypeScript errors to the specific transition', () => {
    // but now it's localized to the `changeSort` transition.
    createStore({
      context: {
        sort: 'asc' as const
      },
      on: {
        // @ts-expect-error
        changeSort: (_, event: { sort: 'desc' }) => ({
          sort: event.sort
        })
      }
    });
  });
});

it('emitted events work with store extensions', () => {
  const store = createStore({
    context: {
      count: 0
    },
    schemas: {
      emitted: {
        increased: schema<{ upBy: number }>()
      }
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
  }).with(reset());

  const spy = vi.fn();

  store.on('increased', spy);

  store.trigger.inc();

  expect(spy).toHaveBeenCalledWith({ type: 'increased', upBy: 1 });
});
