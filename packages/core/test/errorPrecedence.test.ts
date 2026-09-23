import { setTimeout as sleep } from 'node:timers/promises';
import {
  createActor,
  createAsyncLogic,
  createCallbackLogic,
  createMachine
} from '../src/index.ts';
import { reportUnhandledError } from '../src/reportUnhandledError.ts';

vi.mock('../src/reportUnhandledError.ts', () => ({
  reportUnhandledError: vi.fn()
}));

const reported = vi.mocked(reportUnhandledError);

beforeEach(() => {
  reported.mockClear();
});

const boom = new Error('boom');

/**
 * Error-handling precedence contract. An error raised while an actor runs is
 * resolved by the first applicable step:
 *
 * 1. The nearest enclosing state's `onError` (the actor stays active).
 * 2. Subscribers with an `error` observer (no global report).
 * 3. `reportUnhandledError` when no subscriber observes the error.
 */
describe('error precedence', () => {
  it('(a) an execution error recovered by state-level onError does not reach subscribers', async () => {
    const actor = createActor(
      createMachine({
        initial: 'active',
        states: {
          active: {
            on: {
              FAIL: () => {
                throw boom;
              }
            },
            onError: { target: 'recovered' }
          },
          recovered: {}
        }
      })
    );
    const error = vi.fn();
    actor.subscribe({ error });
    actor.start();
    actor.send({ type: 'FAIL' });
    await sleep(0);

    expect(actor.getSnapshot().status).toBe('active');
    expect(actor.getSnapshot().value).toBe('recovered');
    expect(error).not.toHaveBeenCalled();
    expect(reported).not.toHaveBeenCalled();
  });

  it('(b) the nearest enclosing ancestor onError wins', () => {
    const handledBy = vi.fn();
    const actor = createActor(
      createMachine({
        initial: 'outer',
        onError: () => {
          handledBy('root');
          return {};
        },
        states: {
          outer: {
            initial: 'middle',
            onError: () => {
              handledBy('outer');
              return {};
            },
            states: {
              middle: {
                initial: 'leaf',
                onError: () => {
                  handledBy('middle');
                  return {};
                },
                states: {
                  leaf: {
                    on: {
                      FAIL: () => {
                        throw boom;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      })
    ).start();
    actor.send({ type: 'FAIL' });

    expect(actor.getSnapshot().status).toBe('active');
    expect(handledBy.mock.calls).toEqual([['middle']]);
  });

  it('(c) an unrecovered error goes to an error observer and is not reported globally', async () => {
    const actor = createActor(
      createMachine({
        on: {
          FAIL: () => {
            throw boom;
          }
        }
      })
    );
    const error = vi.fn();
    actor.subscribe({ error });
    actor.start();
    actor.send({ type: 'FAIL' });
    await sleep(10);

    expect(actor.getSnapshot().status).toBe('error');
    expect(error).toHaveBeenCalledExactlyOnceWith(boom);
    expect(reported).not.toHaveBeenCalled();
  });

  it('(d) an unrecovered error without an error observer is reported once', async () => {
    const actor = createActor(
      createMachine({
        on: {
          FAIL: () => {
            throw boom;
          }
        }
      })
    );
    actor.subscribe({ next: () => {} });
    actor.start();
    actor.send({ type: 'FAIL' });
    await sleep(10);

    expect(actor.getSnapshot().status).toBe('error');
    expect(reported).toHaveBeenCalledExactlyOnceWith(boom);
  });

  it('(e) subscribing after the actor errored delivers the same error immediately', () => {
    const actor = createActor(
      createMachine({
        on: {
          FAIL: () => {
            throw boom;
          }
        }
      })
    ).start();
    actor.send({ type: 'FAIL' });

    const error = vi.fn();
    actor.subscribe({ error });

    expect(error).toHaveBeenCalledExactlyOnceWith(boom);
  });

  it('(f) a throwing subscribe observer or on() listener does not kill the actor', () => {
    const actor = createActor(
      createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              NEXT: (_, enq) => {
                enq.emit({ type: 'moved' });
                return { target: 'b' };
              }
            }
          },
          b: {
            on: { NEXT: { target: 'a' } }
          }
        }
      })
    );
    const observerError = new Error('observer');
    const listenerError = new Error('listener');
    actor.subscribe(() => {
      throw observerError;
    });
    actor.on('moved', () => {
      throw listenerError;
    });
    actor.start();
    actor.send({ type: 'NEXT' });
    actor.send({ type: 'NEXT' });

    expect(actor.getSnapshot().status).toBe('active');
    expect(actor.getSnapshot().value).toBe('a');
    expect(reported).toHaveBeenCalledWith(observerError);
    expect(reported).toHaveBeenCalledWith(listenerError);
  });

  it('(g) a parent error stops all of its invoked and spawned children', () => {
    const child = createMachine({});
    const actor = createActor(
      createMachine({
        invoke: { id: 'invoked', src: child },
        entry: (_, enq) => {
          enq.spawn(child, { id: 'spawned' });
        },
        on: {
          FAIL: () => {
            throw boom;
          }
        }
      })
    );
    actor.subscribe({ error: () => {} });
    actor.start();
    const { invoked, spawned } = actor.getSnapshot().children as Record<
      string,
      any
    >;
    expect(invoked.getSnapshot().status).toBe('active');
    expect(spawned.getSnapshot().status).toBe('active');

    actor.send({ type: 'FAIL' });

    expect(actor.getSnapshot().status).toBe('error');
    expect(invoked.getSnapshot().status).toBe('stopped');
    expect(spawned.getSnapshot().status).toBe('stopped');
  });

  it("(h) an invoke failure in one parallel region is recovered by that region's onError without exiting siblings", () => {
    const siblingExit = vi.fn();
    const actor = createActor(
      createMachine({
        type: 'parallel',
        states: {
          left: {
            initial: 'working',
            states: {
              working: {
                invoke: {
                  src: createCallbackLogic(() => {
                    throw boom;
                  })
                }
              },
              failed: {}
            },
            onError: { target: '.failed' }
          },
          right: {
            initial: 'idle',
            states: {
              idle: { exit: siblingExit }
            }
          }
        }
      })
    ).start();

    expect(actor.getSnapshot().status).toBe('active');
    expect(actor.getSnapshot().value).toEqual({
      left: 'failed',
      right: 'idle'
    });
    expect(siblingExit).not.toHaveBeenCalled();
  });

  it('(i) an invoked child failure is delivered as xstate.error.actor for that child id', async () => {
    const received = vi.fn();
    const actor = createActor(
      createMachine({
        invoke: {
          id: 'fetcher',
          src: createAsyncLogic({
            run: async () => {
              throw boom;
            }
          })
        },
        on: {
          'xstate.error.actor.fetcher': ({ event }) => {
            received(event);
            return {};
          }
        }
      })
    ).start();
    await sleep(0);

    expect(actor.getSnapshot().status).toBe('active');
    expect(received).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        type: 'xstate.error.actor',
        actorId: 'fetcher',
        error: boom
      })
    );
  });
});
