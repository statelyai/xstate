import { createStore } from '../src';

describe('events', () => {
  it('can infer supported events', () => {
    const store = createStore({
      types: {},
      context: {},
      on: {
        INC: (ctx, payload: { upBy: number }) => {},
        DEC: (ctx, payload: { downBy: number }) => {}
      }
    });

    store.send({ type: 'INC', upBy: 1 });
    store.send({ type: 'DEC', downBy: 1 });
    store.send({
      // @ts-expect-error
      type: 'UNKNOWN'
    });
    store.send({
      type: 'INC',
      // @ts-expect-error
      upBy: 'bazinga'
    });
    store.send({
      type: 'DEC',
      // @ts-expect-error
      downBy: 'bazinga'
    });
  });

  it('can provide event types', () => {
    createStore({
      types: {} as {
        events:
          | {
              type: 'INC';
              upBy: number;
            }
          | {
              type: 'DEC';
              downBy: number;
            };
      },
      context: {},
      on: {
        INC: (ctx, payload) => {
          payload satisfies { upBy: number };
        },
        DEC: (ctx, payload) => {
          payload satisfies { downBy: number };
        }
      }
    });
  });

  it('requires implementing transitions for all provided event types', () => {
    // @ts-expect-error
    createStore({
      types: {} as {
        events:
          | {
              type: 'INC';
              upBy: number;
            }
          | {
              type: 'DEC';
              downBy: number;
            };
      },
      context: {},
      on: {
        INC: () => {}
      }
    });
  });
});

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
        inc: {
          count: (ctx, _: {}, enq) => {
            enq.emit({ type: 'increased', upBy: 1 });
            return ctx;
          }
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
        inc: {
          count: (ctx, _: {}, enq) => {
            enq.emit({
              // @ts-expect-error
              type: 'unknown'
            });
            return ctx;
          }
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
        inc: {
          count: (ctx, _: {}, enq) => {
            enq.emit({
              type: 'increased',
              // @ts-expect-error
              upBy: 'bazinga'
            });
            return ctx;
          }
        }
      }
    });
  });

  it('can emit an event when emitted events are unknown', () => {
    createStore({
      context: {},
      on: {
        inc: {
          count: (ctx, _: {}, enq) => {
            enq.emit({
              type: 'unknown'
            });
            return ctx;
          }
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
