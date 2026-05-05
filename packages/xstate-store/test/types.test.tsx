import { createActor } from 'xstate';
import {
  createAsyncStore,
  createStore,
  createStoreLogic,
  fromStore
} from '../src/index.ts';
import { schema } from './schema.ts';

describe('emitted', () => {
  it('can emit a known event', () => {
    createStore({
      context: {},
      schemas: {
        emitted: {
          increased: schema<{ upBy: number }>()
        }
      },
      on: {
        inc: (ctx, _, enq) => {
          enq.emit.increased({ upBy: 1 });
          return ctx;
        }
      }
    });
  });

  it("can't emit an unknown event", () => {
    createStore({
      context: {},
      schemas: {
        emitted: {
          increased: schema<{ upBy: number }>(),
          decreased: schema<{ downBy: number }>()
        }
      },
      on: {
        inc: (ctx, _, enq) => {
          enq.emit
            // @ts-expect-error
            .unknown();
          return ctx;
        }
      }
    });
  });

  it("can't emit a known event with wrong payload", () => {
    createStore({
      context: {},
      schemas: {
        emitted: {
          increased: schema<{ upBy: number }>(),
          decreased: schema<{ downBy: number }>()
        }
      },
      on: {
        inc: (ctx, _, enq) => {
          enq.emit.increased({
            // @ts-expect-error
            upBy: 'bazinga'
          });
          return ctx;
        }
      }
    });
  });

  it('can subscribe to a known event', () => {
    const store = createStore<
      {},
      {},
      {
        increased: { upBy: number };
        decreased: { downBy: number };
      }
    >({
      context: {},
      on: {}
    });

    store.on('increased', (ev) => {
      ev satisfies { type: 'increased'; upBy: number };
    });
  });

  it("can't subscribe to a unknown event", () => {
    const store = createAsyncStore({
      schemas: {
        emitted: {
          increased: schema<{ upBy: number }>()
        }
      },
      context: {},
      on: {}
    });

    store.on('increased', (ev) => {});

    store.on(
      // @ts-expect-error
      'unknown',
      (ev) => {}
    );
  });

  it('wildcard listener receives union of all emitted events', () => {
    const store = createStore({
      schemas: {
        emitted: {
          increased: schema<{ upBy: number }>(),
          decreased: schema<{ downBy: number }>()
        }
      },
      context: {},
      on: {}
    });

    store.on('*', (ev) => {
      ev satisfies
        | { type: 'increased'; upBy: number }
        | { type: 'decreased'; downBy: number };

      // @ts-expect-error
      ev satisfies { type: 'unknown' };
    });
  });

  it('works with a discriminated union event payload', () => {
    createStore({
      context: {},
      schemas: {
        emitted: {
          log: schema<
            | { level: 'warn'; message: string }
            | { level: 'error'; error: string }
          >()
        }
      },
      on: {
        log: (ctx, _ev, enq) => {
          enq.emit.log({ level: 'warn', message: 'hmm' });
          enq.emit.log({ level: 'error', error: 'uh oh' });
          enq.emit.log({
            level: 'error',
            // @ts-expect-error
            message: 'foo'
          });
          return ctx;
        }
      }
    });
  });
});

describe('trigger', () => {
  it('works with a distributive event payload', () => {
    const store = createStore({
      context: {},
      on: {
        log: (
          ctx,
          _ev:
            | { level: 'warn'; message: string }
            | { level: 'error'; error: string }
        ) => {
          return ctx;
        }
      }
    });

    store.trigger.log({ level: 'warn', message: 'hmm' });
    store.trigger.log({ level: 'error', error: 'uh oh' });

    store.trigger.log({
      level: 'error',
      // @ts-expect-error
      message: 'foo'
    });
  });

  it('uses schema-declared events for trigger typing', () => {
    const store = createStore({
      schemas: {
        events: {
          log: schema<
            | { level: 'warn'; message: string }
            | { level: 'error'; error: string }
          >()
        }
      },
      context: {},
      on: {}
    });

    store.trigger.log({ level: 'warn', message: 'hmm' });
    store.trigger.log({ level: 'error', error: 'uh oh' });

    store.trigger.log({
      level: 'error',
      // @ts-expect-error
      message: 'foo'
    });
  });

  it('preserves inferred trigger typing when only emitted schemas are declared', () => {
    const store = createStore({
      schemas: {
        emitted: {
          logged: schema<{ message: string }>()
        }
      },
      context: {},
      on: {
        log: (ctx, ev: { message: string }, enq) => {
          enq.emit.logged({ message: ev.message });
          return ctx;
        }
      }
    });

    store.trigger.log({ message: 'hello' });

    if (false) {
      // @ts-expect-error
      store.trigger.log({});

      // @ts-expect-error
      store.trigger.unknown();
    }
  });

  it('uses schema-declared events for enqueued trigger typing', () => {
    createStore({
      schemas: {
        events: {
          log: schema<
            | { level: 'warn'; message: string }
            | { level: 'error'; error: string }
          >(),
          flush: schema<{}>()
        }
      },
      context: {},
      on: {
        flush: (ctx, _event, enq) => {
          enq.trigger.log({ level: 'warn', message: 'hmm' });
          enq.trigger.log({ level: 'error', error: 'uh oh' });

          enq.trigger.log({
            level: 'error',
            // @ts-expect-error
            message: 'foo'
          });

          // @ts-expect-error
          enq.trigger.unknown();

          return ctx;
        }
      }
    });
  });
});

describe('logic selectors', () => {
  it('infers selected values from a store', () => {
    const store = createStore({
      context: { count: 0 },
      on: {
        inc: (context) => ({ count: context.count + 1 })
      }
    });
    const count = store.select((context) => context.count);
    const label = store.select((context) => `Count: ${context.count}`);

    count.get() satisfies number;
    label.get() satisfies string;

    if (false) {
      // @ts-expect-error
      count.get() satisfies string;
    }
  });

  it('infers input and selector values from reusable store logic', () => {
    const counterLogic = createStoreLogic({
      context: (input: { initialCount: number }) => ({
        count: input.initialCount
      }),
      selectors: {
        count: (context: { count: number }) => context.count,
        label: (context: { count: number }) => `Count: ${context.count}`
      },
      on: {
        inc: (context) => ({ count: context.count + 1 })
      }
    });

    const store = counterLogic.createStore({ initialCount: 1 });

    store.selectors.count.get() satisfies number;
    store.selectors.label.get() satisfies string;

    if (false) {
      // @ts-expect-error
      counterLogic.createStore();

      // @ts-expect-error
      counterLogic.createStore({ initialCount: 'one' });

      // @ts-expect-error
      store.selectors.label.get() satisfies number;
    }
  });
});

describe('schemas', () => {
  it('types async steps', () => {
    const store = createAsyncStore({
      context: {
        result: 0
      },
      on: {
        load: async (ctx, _event, enq) => {
          const result = await enq.step('fetchResult', async () => 42);

          result satisfies number;
          // @ts-expect-error
          result satisfies string;

          return {
            result: ctx.result + result
          };
        }
      }
    });

    const asyncExecution =
      store.getSnapshot().async?.[
        Object.keys(store.getSnapshot().async ?? {})[0]
      ];
    asyncExecution?.steps.fetchResult?.status satisfies
      | 'active'
      | 'done'
      | 'error'
      | undefined;
  });

  it('uses schema-declared context for snapshot typing', () => {
    const store = createStore({
      schemas: {
        context: schema<{ count: number; label: string }>()
      },
      context: {
        count: 0,
        label: 'ready'
      },
      on: {}
    });

    store.getSnapshot().context.label satisfies string;

    // @ts-expect-error
    store.getSnapshot().context.label satisfies number;
  });

  it('merges schema-declared context with inferred event types', () => {
    const store = createStore({
      schemas: {
        context: schema<{ count: number; label: string }>()
      },
      context: {
        count: 0,
        label: 'ready'
      },
      on: {
        rename: (ctx, ev: { label: string }) => ({
          ...ctx,
          label: ev.label
        })
      }
    });

    store.trigger.rename({ label: 'done' });
    store.getSnapshot().context.label satisfies string;

    if (false) {
      // @ts-expect-error
      store.trigger.rename({});
    }
  });
});

describe('fromStore schemas', () => {
  it('preserves inferred event types when only emitted schemas are declared', () => {
    const logic = fromStore({
      context: (count: number) => ({ count }),
      schemas: {
        emitted: {
          increased: schema<{ upBy: number }>()
        }
      },
      on: {
        inc: (ctx, ev: { by: number }, enq) => {
          enq.emit.increased({ upBy: ev.by });
          return {
            count: ctx.count + ev.by
          };
        }
      }
    });

    const actor = createActor(logic, {
      input: 1
    });

    actor.send({ type: 'inc', by: 2 });
    actor.on('increased', (event) => {
      event.upBy satisfies number;
    });

    if (false) {
      actor.send({
        type: 'inc',
        // @ts-expect-error
        message: 'nope'
      });

      actor.on(
        // @ts-expect-error
        'unknown',
        () => {}
      );
    }
  });

  it('uses schema-declared events for send typing', () => {
    const logic = fromStore({
      context: {
        count: 0
      },
      schemas: {
        events: {
          inc: schema<{ by: number }>(),
          reset: schema<{}>()
        }
      },
      on: {
        inc: (ctx, ev) => ({
          count: ctx.count + ev.by
        })
      }
    });

    const actor = createActor(logic);

    actor.send({ type: 'inc', by: 1 });
    actor.send({ type: 'reset' });

    if (false) {
      // @ts-expect-error
      actor.send({ type: 'inc' });

      // @ts-expect-error
      actor.send({ type: 'unknown' });
    }
  });

  it('uses schema-declared context for snapshot typing', () => {
    const logic = fromStore({
      schemas: {
        context: schema<{ count: number; label: string }>()
      },
      context: {
        count: 0,
        label: 'ready'
      },
      on: {}
    });

    const snapshot = logic.getInitialSnapshot({} as any, undefined as never);

    snapshot.context.label satisfies string;

    // @ts-expect-error
    snapshot.context.label satisfies number;
  });
});
