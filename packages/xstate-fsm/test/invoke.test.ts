import { createMachine, assign, interpret } from '../src';
import { fromPromise } from '../src/fromPromise';
import { fromCallback } from '../src/fromCallback';

describe('invoking promises', () => {
  it('can invoke a promise that resolves with onDone', (done) => {
    const fsm = createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            FETCH: 'loading'
          }
        },
        loading: {
          invoke: {
            src: fromPromise(() => Promise.resolve('data')),
            onDone: {
              target: 'success',
              // actions: (ctx, ev) => {
              //   ev.data; // properly inferred as string
              // }
              actions: assign({
                // ev.data improperly inferred as any
                data: (_, event) => event.data
              })
            }
          }
        },
        success: {}
      }
    });

    const service = interpret(fsm).start();

    service.subscribe((state) => {
      if (state.value === 'success') {
        expect(state.context.data).toEqual('data');
        done();
      }
    });

    service.send({ type: 'FETCH' });
  });

  it('can invoke a promise that rejects with onError', (done) => {
    const fsm = createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            FETCH: 'loading'
          }
        },
        loading: {
          invoke: {
            src: fromPromise(() => Promise.reject('data')),
            onError: {
              target: 'failure',
              actions: assign({
                data: (_, event) => event.data
              })
            }
          }
        },
        failure: {}
      }
    });

    const service = interpret(fsm).start();

    service.subscribe((state) => {
      if (state.value === 'failure') {
        expect(state.context.data).toEqual('data');
        done();
      }
    });

    service.send({ type: 'FETCH' });
  });
});

describe('invoking callbacks', () => {
  it('can invoke a callback', (done) => {
    const fsm = createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            FETCH: 'loading'
          }
        },
        loading: {
          invoke: {
            src: fromCallback((sendBack) => {
              sendBack({ type: 'event' });
            })
          },
          on: {
            event: 'success'
          }
        },
        success: {}
      }
    });

    const service = interpret(fsm).start();

    service.subscribe((state) => {
      if (state.value === 'success') {
        done();
      }
    });

    service.send({ type: 'FETCH' });
  });

  it('can cancel a callback', (done) => {
    let cancelCalled = false;
    const fsm = createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            FETCH: 'loading'
          }
        },
        loading: {
          invoke: {
            src: fromCallback(() => {
              return () => {
                cancelCalled = true;
              };
            })
          },
          on: {
            skip: 'skipped'
          }
        },
        skipped: {}
      }
    });

    const service = interpret(fsm).start();

    service.send({ type: 'FETCH' });
    service.send({ type: 'skip' });

    setTimeout(() => {
      expect(cancelCalled).toBeTruthy();
      done();
    }, 100);
  });
});
