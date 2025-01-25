import { createStore } from '../src/index';

describe('emitted', () => {
  it('can emit a known event', () => {
    createStore({
      types: {
        emitted: {} as
          | { type: 'increased'; upBy: number }
          | { type: 'decreased'; downBy: number }
      },
      context: {},
      on: {
        inc: (ctx, _, enq) => {
          enq.emit({ type: 'increased', upBy: 1 });
          return ctx;
        }
      }
    });
  });

  it("can't emit an unknown event", () => {
    createStore({
      types: {
        emitted: {} as
          | { type: 'increased'; upBy: number }
          | { type: 'decreased'; downBy: number }
      },
      context: {},
      on: {
        inc: (ctx, _, enq) => {
          enq.emit({
            // @ts-expect-error
            type: 'unknown'
          });
          return ctx;
        }
      }
    });
  });

  it("can't emit a known event with wrong payload", () => {
    createStore({
      types: {
        emitted: {} as
          | { type: 'increased'; upBy: number }
          | { type: 'decreased'; downBy: number }
      },
      context: {},
      on: {
        inc: (ctx, _, enq) => {
          enq.emit({
            type: 'increased',
            // @ts-expect-error
            upBy: 'bazinga'
          });
          return ctx;
        }
      }
    });
  });

  it('can emit an event when emitted events are unknown', () => {
    createStore({
      context: {},
      on: {
        inc: (ctx, _, enq) => {
          enq.emit({
            type: 'unknown'
          });
          return ctx;
        }
      }
    });
  });

  it('can subscribe to a known event', () => {
    const store = createStore({
      types: {
        emitted: {} as
          | { type: 'increased'; upBy: number }
          | { type: 'decreased'; downBy: number }
      },
      context: {},
      on: {}
    });

    store.on('increased', (ev) => {
      ev satisfies { type: 'increased'; upBy: number };
    });
  });

  it("can can't subscribe to a unknown event", () => {
    const store = createStore({
      types: {
        emitted: {} as
          | { type: 'increased'; upBy: number }
          | { type: 'decreased'; downBy: number }
      },
      context: {},
      on: {}
    });

    store.on(
      // @ts-expect-error
      'unknown',
      (ev) => {}
    );
  });
});

describe('type parameters', () => {
  it('type parameters can be provided', () => {
    createStore<
      { count: number },
      | { type: 'increment'; by: number }
      | { type: 'decrement' }
      | { type: 'other' }
    >({
      context: {
        count: 0
      },
      on: {
        increment: (ctx, ev) => {
          ev.by satisfies number;

          // @ts-expect-error
          ev.by satisfies string;

          return { ...ctx, count: ctx.count + ev.by };
        },

        // @ts-expect-error
        whatever: (ctx) => ({ ...ctx, count: 1 }),

        decrement: (ctx) => {
          // @ts-expect-error
          ctx.whatever;
        },

        // @ts-expect-error
        other: () => ({
          count: 'whatever'
        })
      }
    });
  });
});
