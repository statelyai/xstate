import { createStore } from '../src/index';

describe('emitted', () => {
  it('can emit a known event', () => {
    createStore<
      {},
      {
        inc: { upBy: number };
      },
      {
        increased: { upBy: number };
        decreased: { downBy: number };
      }
    >({
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
    createStore<
      {},
      {
        inc: { upBy: number };
      },
      {
        increased: { upBy: number };
        decreased: { downBy: number };
      }
    >({
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
    createStore<
      {},
      {
        inc: { upBy: number };
      },
      {
        increased: { upBy: number };
        decreased: { downBy: number };
      }
    >({
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

  it("can can't subscribe to a unknown event", () => {
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

    store.on(
      // @ts-expect-error
      'unknown',
      (ev) => {}
    );
  });
});
