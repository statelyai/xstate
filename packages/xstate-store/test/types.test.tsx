import { createStore } from '../src/index.ts';

describe('emitted', () => {
  it('can emit a known event', () => {
    createStore({
      context: {},
      emits: {
        increased: (_: { upBy: number }) => {}
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
      emits: {
        increased: (_: { upBy: number }) => {},
        decreased: (_: { downBy: number }) => {}
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
      emits: {
        increased: (_: { upBy: number }) => {},
        decreased: (_: { downBy: number }) => {}
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
    const store = createStore({
      emits: {
        increased: (_: { upBy: number }) => {}
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

  it('works with a discriminated union event payload', () => {
    createStore({
      context: {},
      emits: {
        log: (
          _:
            | { level: 'warn'; message: string }
            | { level: 'error'; error: string }
        ) => {}
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
});

describe('enqueue effects', () => {
  it('can enqueue only sync and async functions', () => {
    const waitAsecond = () =>
      new Promise((resolve) => setTimeout(resolve, 1000));

    const store = createStore({
      context: { count: 0 },
      on: {
        increment: (ctx, _, enq) => {
          // @ts-expect-error
          enq.effect({ answer: 84 });

          // @ts-expect-error
          enq.effect(waitAsecond());

          enq.effect(() => {
            store.send({ type: 'decrement' });
          });

          enq.effect(async () => {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            store.send({ type: 'decrement' });
          });

          return {
            ...ctx,
            count: ctx.count + 1
          };
        },
        decrement: (ctx) => ({
          ...ctx,
          count: ctx.count - 1
        })
      }
    });
  });
});
