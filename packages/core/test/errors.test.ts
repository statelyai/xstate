import { setTimeout as sleep } from 'node:timers/promises';
import {
  createActor,
  next_createMachine,
  fromCallback,
  fromPromise,
  fromTransition,
  AnyEventObject
} from '../src';
import z from 'zod';

// mocked reportUnhandledError due to unknown issue with vitest and global error
// handlers not catching thrown errors
// see: https://github.com/vitest-dev/vitest/issues/6292
vi.mock('../src/reportUnhandledError.ts', () => {
  return {
    reportUnhandledError: (err: unknown) => {
      setTimeout(() => {
        dispatchEvent(new ErrorEvent('error', { error: err }));
      });
    }
  };
});

const cleanups: (() => void)[] = [];
function installGlobalOnErrorHandler(handler: (ev: ErrorEvent) => void) {
  window.addEventListener('error', handler);
  cleanups.push(() => window.removeEventListener('error', handler));
}

afterEach(() => {
  cleanups.forEach((cleanup) => cleanup());
  cleanups.length = 0;
});

describe('error handling', () => {
  // https://github.com/statelyai/xstate/issues/4004
  it('does not cause an infinite loop when an error is thrown in subscribe', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const machine = next_createMachine({
      id: 'machine',
      initial: 'initial',
      context: {
        count: 0
      },
      states: {
        initial: {
          on: { activate: 'active' }
        },
        active: {}
      }
    });

    const spy = vi.fn().mockImplementation(() => {
      throw new Error('no_infinite_loop_when_error_is_thrown_in_subscribe');
    });

    const actor = createActor(machine).start();

    actor.subscribe(spy);
    actor.send({ type: 'activate' });

    expect(spy).toHaveBeenCalledTimes(1);

    installGlobalOnErrorHandler((ev) => {
      ev.preventDefault();
      expect(ev.error.message).toEqual(
        'no_infinite_loop_when_error_is_thrown_in_subscribe'
      );
      resolve();
    });

    return promise;
  });

  it(`doesn't crash the actor when an error is thrown in subscribe`, () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const spy = vi.fn();

    const machine = next_createMachine({
      id: 'machine',
      initial: 'initial',
      context: {
        count: 0
      },
      states: {
        initial: {
          on: { activate: 'active' }
        },
        active: {
          on: {
            do: (_, enq) => {
              enq(spy);
            }
          }
        }
      }
    });

    const subscriber = vi.fn().mockImplementationOnce(() => {
      throw new Error('doesnt_crash_actor_when_error_is_thrown_in_subscribe');
    });

    const actor = createActor(machine).start();

    actor.subscribe(subscriber);
    actor.send({ type: 'activate' });

    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(actor.getSnapshot().status).toEqual('active');

    installGlobalOnErrorHandler((ev) => {
      ev.preventDefault();
      expect(ev.error.message).toEqual(
        'doesnt_crash_actor_when_error_is_thrown_in_subscribe'
      );

      actor.send({ type: 'do' });
      expect(spy).toHaveBeenCalledTimes(1);

      resolve();
    });

    return promise;
  });

  it(`doesn't notify error listener when an error is thrown in subscribe`, () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const machine = next_createMachine({
      id: 'machine',
      initial: 'initial',
      context: {
        count: 0
      },
      states: {
        initial: {
          on: { activate: 'active' }
        },
        active: {}
      }
    });

    const nextSpy = vi.fn().mockImplementation(() => {
      throw new Error(
        'doesnt_notify_error_listener_when_error_is_thrown_in_subscribe'
      );
    });
    const errorSpy = vi.fn();

    const actor = createActor(machine).start();

    actor.subscribe({
      next: nextSpy,
      error: errorSpy
    });
    actor.send({ type: 'activate' });

    expect(nextSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(0);

    installGlobalOnErrorHandler((ev) => {
      ev.preventDefault();
      expect(ev.error.message).toEqual(
        'doesnt_notify_error_listener_when_error_is_thrown_in_subscribe'
      );
      resolve();
    });

    return promise;
  });

  it('unhandled sync errors thrown when starting a child actor should be reported globally', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const machine = next_createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: fromCallback(() => {
              throw new Error('unhandled_sync_error_in_actor_start');
            }),
            onDone: 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    createActor(machine).start();

    installGlobalOnErrorHandler((ev) => {
      ev.preventDefault();
      expect(ev.error.message).toEqual('unhandled_sync_error_in_actor_start');
      resolve();
    });

    return promise;
  });

  it('unhandled rejection of a promise actor should be reported globally in absence of error listener', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const machine = next_createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: fromPromise(() =>
              Promise.reject(
                new Error(
                  'unhandled_rejection_in_promise_actor_without_error_listener'
                )
              )
            ),
            onDone: 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    createActor(machine).start();

    installGlobalOnErrorHandler((ev) => {
      ev.preventDefault();
      expect(ev.error.message).toEqual(
        'unhandled_rejection_in_promise_actor_without_error_listener'
      );
      resolve();
    });

    return promise;
  });

  it('unhandled rejection of a promise actor should be reported to the existing error listener of its parent', async () => {
    const errorSpy = vi.fn();

    const machine = next_createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: fromPromise(() =>
              Promise.reject(
                new Error(
                  'unhandled_rejection_in_promise_actor_with_parent_listener'
                )
              )
            ),
            onDone: 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const actorRef = createActor(machine);
    actorRef.subscribe({
      error: errorSpy
    });
    actorRef.start();

    await sleep(0);

    expect(errorSpy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          [Error: unhandled_rejection_in_promise_actor_with_parent_listener],
        ],
      ]
    `);
  });

  it('unhandled rejection of a promise actor should be reported to the existing error listener of its grandparent', async () => {
    const errorSpy = vi.fn();

    const child = next_createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: fromPromise(() =>
              Promise.reject(
                new Error(
                  'unhandled_rejection_in_promise_actor_with_grandparent_listener'
                )
              )
            ),
            onDone: 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const machine = next_createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: child,
            onDone: 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const actorRef = createActor(machine);
    actorRef.subscribe({
      error: errorSpy
    });
    actorRef.start();

    await sleep(0);

    expect(errorSpy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          [Error: unhandled_rejection_in_promise_actor_with_grandparent_listener],
        ],
      ]
    `);
  });

  it('handled sync errors thrown when starting a child actor should not be reported globally', () => {
    const { resolve, reject, promise } = Promise.withResolvers<void>();
    const machine = next_createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: fromCallback(() => {
              throw new Error('handled_sync_error_in_actor_start');
            }),
            onError: 'failed'
          }
        },
        failed: {
          type: 'final'
        }
      }
    });

    createActor(machine).start();

    installGlobalOnErrorHandler(() => {
      reject(new Error('Fail'));
    });

    setTimeout(() => {
      resolve();
    }, 10);

    return promise;
  });

  it('handled sync errors thrown when starting a child actor should be reported globally when not all of its own observers come with an error listener', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const machine = next_createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: fromCallback(() => {
              throw new Error('handled_sync_error_in_actor_start');
            }),
            onError: 'failed'
          }
        },
        failed: {
          type: 'final'
        }
      }
    });

    const actorRef = createActor(machine);
    const childActorRef = Object.values(actorRef.getSnapshot().children)[0];
    childActorRef.subscribe({
      error: function preventUnhandledErrorListener() {}
    });
    childActorRef.subscribe(() => {});
    actorRef.start();

    installGlobalOnErrorHandler((ev) => {
      ev.preventDefault();
      expect(ev.error.message).toEqual('handled_sync_error_in_actor_start');
      resolve();
    });

    return promise;
  });

  it('handled sync errors thrown when starting a child actor should not be reported globally when all of its own observers come with an error listener', () => {
    const { resolve, reject, promise } = Promise.withResolvers<void>();
    const machine = next_createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: fromCallback(() => {
              throw new Error('handled_sync_error_in_actor_start');
            }),
            onError: 'failed'
          }
        },
        failed: {
          type: 'final'
        }
      }
    });

    const actorRef = createActor(machine);
    const childActorRef = Object.values(actorRef.getSnapshot().children)[0];
    childActorRef.subscribe({
      error: function preventUnhandledErrorListener() {}
    });
    childActorRef.subscribe({
      error: function preventUnhandledErrorListener() {}
    });
    actorRef.start();

    installGlobalOnErrorHandler(() => {
      reject(new Error('Fail'));
    });

    setTimeout(() => {
      resolve();
    }, 10);

    return promise;
  });

  it('unhandled sync errors thrown when starting a child actor should be reported twice globally when not all of its own observers come with an error listener and when the root has no error listener of its own', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const machine = next_createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: fromCallback(() => {
              throw new Error('handled_sync_error_in_actor_start');
            })
          }
        }
      }
    });

    const actorRef = createActor(machine);
    const childActorRef = Object.values(actorRef.getSnapshot().children)[0];
    childActorRef.subscribe({
      error: function preventUnhandledErrorListener() {}
    });
    childActorRef.subscribe({});
    actorRef.start();

    const actual: string[] = [];

    installGlobalOnErrorHandler((ev) => {
      ev.preventDefault();
      actual.push(ev.error.message);

      if (actual.length === 2) {
        expect(actual).toEqual([
          'handled_sync_error_in_actor_start',
          'handled_sync_error_in_actor_start'
        ]);
        resolve();
      }
    });

    return promise;
  });

  it(`handled sync errors shouldn't notify the error listener`, () => {
    const machine = next_createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: fromCallback(() => {
              throw new Error('handled_sync_error_in_actor_start');
            }),
            onError: 'failed'
          }
        },
        failed: {
          type: 'final'
        }
      }
    });

    const errorSpy = vi.fn();

    const actorRef = createActor(machine);
    actorRef.subscribe({
      error: errorSpy
    });
    actorRef.start();

    expect(errorSpy).toHaveBeenCalledTimes(0);
  });

  it(`unhandled sync errors should notify the root error listener`, () => {
    const machine = next_createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: fromCallback(() => {
              throw new Error(
                'unhandled_sync_error_in_actor_start_with_root_error_listener'
              );
            }),
            onDone: 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const errorSpy = vi.fn();

    const actorRef = createActor(machine);
    actorRef.subscribe({
      error: errorSpy
    });
    actorRef.start();

    expect(errorSpy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          [Error: unhandled_sync_error_in_actor_start_with_root_error_listener],
        ],
      ]
    `);
  });

  it(`unhandled sync errors should not notify the global listener when the root error listener is present`, () => {
    const { resolve, reject, promise } = Promise.withResolvers<void>();
    const machine = next_createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: fromCallback(() => {
              throw new Error(
                'unhandled_sync_error_in_actor_start_with_root_error_listener'
              );
            }),
            onDone: 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const errorSpy = vi.fn();

    const actorRef = createActor(machine);
    actorRef.subscribe({
      error: errorSpy
    });
    actorRef.start();

    expect(errorSpy).toHaveBeenCalledTimes(1);

    installGlobalOnErrorHandler(() => {
      reject(new Error('Fail'));
    });

    setTimeout(() => {
      resolve();
    }, 10);

    return promise;
  });

  it(`handled sync errors thrown when starting an actor shouldn't crash the parent`, () => {
    const spy = vi.fn();

    const machine = next_createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: fromCallback(() => {
              throw new Error('handled_sync_error_in_actor_start');
            }),
            onError: 'failed'
          }
        },
        failed: {
          on: {
            do: (_, enq) => {
              enq(spy);
            }
          }
        }
      }
    });

    const actorRef = createActor(machine);
    actorRef.start();

    expect(actorRef.getSnapshot().status).toBe('active');

    actorRef.send({ type: 'do' });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it(`unhandled sync errors thrown when starting an actor should crash the parent`, () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const machine = next_createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: fromCallback(() => {
              throw new Error('unhandled_sync_error_in_actor_start');
            })
          }
        }
      }
    });

    const actorRef = createActor(machine);
    actorRef.start();

    expect(actorRef.getSnapshot().status).toBe('error');

    installGlobalOnErrorHandler((ev) => {
      ev.preventDefault();
      expect(ev.error.message).toEqual('unhandled_sync_error_in_actor_start');
      resolve();
    });

    return promise;
  });

  it(`error thrown by the error listener should be reported globally`, () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const machine = next_createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: fromCallback(() => {
              throw new Error('handled_sync_error_in_actor_start');
            })
          }
        }
      }
    });

    const actorRef = createActor(machine);
    actorRef.subscribe({
      error: () => {
        throw new Error('error_thrown_by_error_listener');
      }
    });
    actorRef.start();

    installGlobalOnErrorHandler((ev) => {
      ev.preventDefault();
      expect(ev.error.message).toEqual('error_thrown_by_error_listener');
      resolve();
    });

    return promise;
  });

  it(`error should be reported globally if not every observer comes with an error listener`, () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const machine = next_createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: fromCallback(() => {
              throw new Error(
                'error_thrown_when_not_every_observer_comes_with_an_error_listener'
              );
            })
          }
        }
      }
    });

    const actorRef = createActor(machine);
    actorRef.subscribe({
      error: function preventUnhandledErrorListener() {}
    });
    actorRef.subscribe(() => {});
    actorRef.start();

    installGlobalOnErrorHandler((ev) => {
      ev.preventDefault();
      expect(ev.error.message).toEqual(
        'error_thrown_when_not_every_observer_comes_with_an_error_listener'
      );
      resolve();
    });
    return promise;
  });

  it(`uncaught error and an error thrown by the error listener should both be reported globally when not every observer comes with an error listener`, () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const machine = next_createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: fromCallback(() => {
              throw new Error(
                'error_thrown_when_not_every_observer_comes_with_an_error_listener'
              );
            })
          }
        }
      }
    });

    const actorRef = createActor(machine);
    actorRef.subscribe({
      error: () => {
        throw new Error('error_thrown_by_error_listener');
      }
    });
    actorRef.subscribe(() => {});
    actorRef.start();

    let actual: string[] = [];

    installGlobalOnErrorHandler((ev) => {
      ev.preventDefault();
      actual.push(ev.error.message);

      if (actual.length === 2) {
        expect(actual).toEqual([
          'error_thrown_by_error_listener',
          'error_thrown_when_not_every_observer_comes_with_an_error_listener'
        ]);
        resolve();
      }
    });

    return promise;
  });

  it('error thrown in initial custom entry action should error the actor', () => {
    const machine = next_createMachine({
      entry: () => {
        throw new Error('error_thrown_in_initial_entry_action');
      }
    });

    const errorSpy = vi.fn();

    const actorRef = createActor(machine);
    actorRef.subscribe({
      error: errorSpy
    });
    actorRef.start();

    const snapshot = actorRef.getSnapshot();
    expect(snapshot.status).toBe('error');
    expect(snapshot.error).toMatchInlineSnapshot(
      `[Error: error_thrown_in_initial_entry_action]`
    );
    expect(errorSpy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          [Error: error_thrown_in_initial_entry_action],
        ],
      ]
    `);
  });

  it('error thrown by a custom entry action when transitioning should error the actor', () => {
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          entry: () => {
            throw new Error(
              'error_thrown_in_a_custom_entry_action_when_transitioning'
            );
          }
        }
      }
    });

    const errorSpy = vi.fn();

    const actorRef = createActor(machine);
    actorRef.subscribe({
      error: errorSpy
    });
    actorRef.start();
    actorRef.send({ type: 'NEXT' });

    const snapshot = actorRef.getSnapshot();
    expect(snapshot.status).toBe('error');
    expect(snapshot.error).toMatchInlineSnapshot(
      `[Error: error_thrown_in_a_custom_entry_action_when_transitioning]`
    );
    expect(errorSpy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          [Error: error_thrown_in_a_custom_entry_action_when_transitioning],
        ],
      ]
    `);
  });

  it(`shouldn't execute deferred initial actions that come after an action that errors`, () => {
    const spy = vi.fn();

    const machine = next_createMachine({
      entry: (_, enq) => {
        enq(() => {
          throw new Error('error_thrown_in_initial_entry_action');
        });
        enq(spy);
      }
    });

    const actorRef = createActor(machine);
    actorRef.subscribe({ error: function preventUnhandledErrorListener() {} });
    actorRef.start();

    expect(spy).toHaveBeenCalledTimes(0);
  });

  it('should error the parent on errored initial state of a child', async () => {
    const immediateFailure = fromTransition((_) => undefined, undefined);
    immediateFailure.getInitialSnapshot = () => ({
      status: 'error',
      output: undefined,
      error: 'immediate error!',
      context: undefined
    });

    const machine = next_createMachine({
      invoke: {
        src: immediateFailure
      }
    });

    const actorRef = createActor(machine);
    actorRef.subscribe({ error: function preventUnhandledErrorListener() {} });
    actorRef.start();

    const snapshot = actorRef.getSnapshot();

    expect(snapshot.status).toBe('error');
    expect(snapshot.error).toBe('immediate error!');
  });

  it('actor continues to work normally after emit callback errors', async () => {
    // const machine = setup({
    //   types: {
    //     emitted: {} as { type: 'emitted'; foo: string }
    //   }
    // }).

    const machine = next_createMachine({
      schemas: {
        emitted: z.object({
          type: z.literal('emitted'),
          foo: z.string()
        })
      },
      on: {
        // someEvent: {
        //   actions: emit({ type: 'emitted', foo: 'bar' })
        // }
        someEvent: (_, enq) => {
          enq.emit({
            type: 'emitted',
            foo: 'bar'
          });
        }
      }
    });

    const actor = createActor(machine).start();
    let errorThrown = false;

    actor.on('emitted', () => {
      errorThrown = true;
      throw new Error('oops');
    });

    // Send first event - should trigger error but actor should remain active
    actor.send({ type: 'someEvent' });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(errorThrown).toBe(true);
    expect(actor.getSnapshot().status).toEqual('active');

    // Send second event - should work normally without error
    const event = await new Promise<AnyEventObject>((res) => {
      actor.on('emitted', res);
      actor.send({ type: 'someEvent' });
    });

    expect(event.foo).toBe('bar');
    expect(actor.getSnapshot().status).toEqual('active');
  });
});
