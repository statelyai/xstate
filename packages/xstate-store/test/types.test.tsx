import { createStore } from '../src/index';

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
});
