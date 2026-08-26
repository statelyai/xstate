import { Context, Effect, Stream } from 'effect';
import { createActor, createMachine, setup, types } from 'xstate';
import {
  createEffectActor,
  fromEffect,
  fromEffectEventStream,
  fromEffectStream,
  setupEffect
} from './index.ts';

const waitForEffects = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('@xstate/effect', () => {
  it('runs setupEffect actions inside the host Effect context', async () => {
    interface Audit {
      record: (value: number) => void;
    }
    const Audit = Context.Service<Audit>('Audit');
    const recorded: number[] = [];

    const effectSetup = setupEffect({
      actions: {
        audit: ({ context }) =>
          Audit.use((audit) => Effect.sync(() => audit.record(context.count)))
      }
    });
    const machine = effectSetup.createMachine({
      context: { count: 1 },
      initial: 'active',
      states: {
        active: {
          on: {
            AUDIT: (args, enq) => {
              enq(args.actions.audit, args);
            }
          }
        }
      }
    });

    const actor = await Effect.runPromise(
      Effect.provideService(createEffectActor(machine), Audit, {
        record: (value) => recorded.push(value)
      })
    );
    const runWithoutAudit = () => {
      // @ts-expect-error -- the actor requires the Audit service
      Effect.runPromise(createEffectActor(machine));
    };
    void runWithoutAudit;

    actor.send({ type: 'AUDIT' });
    await waitForEffects();

    expect(recorded).toEqual([1]);
  });

  it('routes failed Effect actions through the machine error transition', async () => {
    const failure = { code: 'AUDIT_FAILED' as const };
    let received: unknown;
    const effectSetup = setupEffect({
      actions: {
        fail: (_args) => Effect.fail(failure)
      }
    });
    const machine = effectSetup.createMachine({
      initial: 'active',
      states: {
        active: {
          on: {
            FAIL: (args, enq) => enq(args.actions.fail, args)
          },
          onError: ({ event }) => {
            received = event.error;
            return { target: 'failed' };
          }
        },
        failed: {}
      }
    });

    const actor = await Effect.runPromise(createEffectActor(machine));
    actor.send({ type: 'FAIL' });
    await waitForEffects();

    expect(actor.getSnapshot().value).toBe('failed');
    expect(received).toEqual(failure);
  });

  it('invokes an Effect actor and routes success to onDone', async () => {
    const logic = fromEffect(Effect.succeed('ok'));
    const machine = createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: logic,
            onDone: {
              target: 'success',
              context: ({ event }) => ({ result: event.output })
            }
          }
        },
        success: {}
      }
    });

    const actor = await Effect.runPromise(createEffectActor(machine));
    await waitForEffects();

    expect(actor.getSnapshot().value).toBe('success');
    expect(actor.getSnapshot().context).toEqual({ result: 'ok' });
  });

  it('routes typed Effect failures to onError', async () => {
    const failure = { code: 'NOT_FOUND' as const };
    const logic = fromEffect(Effect.fail(failure));
    const machine = createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: logic,
            onError: {
              target: 'failed',
              context: ({ event }) => ({ error: event.error })
            }
          }
        },
        failed: {}
      }
    });

    const actor = await Effect.runPromise(createEffectActor(machine));
    await waitForEffects();

    expect(actor.getSnapshot().value).toBe('failed');
    expect(actor.getSnapshot().context).toEqual({ error: failure });
  });

  it('preserves typed Effect errors through registered v6 actors', () => {
    const failure = { code: 'NOT_FOUND' as const };
    const request = fromEffect(Effect.fail(failure));
    const effectSetup = setupEffect({ actors: { request } });
    const machine = effectSetup.createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: 'request',
            onError: ({ event }) => {
              const code: 'NOT_FOUND' = event.error.code;
              // @ts-expect-error -- the Effect failure is discriminated
              const other: 'OTHER' = code;
              void other;
              return { target: 'failed' };
            }
          }
        },
        failed: {}
      }
    });

    expect(machine).toBeDefined();
  });

  it('collects requirements from registered Effect actors', () => {
    const Service = Context.Service<{ value: number }>('Service');
    const logic = fromEffect(
      Service.use((service) => Effect.succeed(service.value))
    );
    const runWithoutService = () => {
      // @ts-expect-error -- the actor requires Service
      Effect.runPromise(createEffectActor(logic));
    };
    void runWithoutService;
    const machine = setup({ actors: { logic } }).createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: { src: 'logic' }
        }
      }
    });

    const runWithoutRegisteredService = () => {
      // @ts-expect-error -- the registered actor requires Service
      Effect.runPromise(createEffectActor(machine));
    };
    void runWithoutRegisteredService;
  });

  it('rejects running Effect logic through ordinary createActor', () => {
    const actor = createActor(fromEffect(Effect.succeed('ok')));
    actor.subscribe({ error: () => {} });
    actor.start();

    expect(actor.getSnapshot().status).toBe('error');
  });

  it('exposes the latest item from an Effect stream and completes', async () => {
    const actor = await Effect.runPromise(
      createEffectActor(fromEffectStream(Stream.make(1, 2, 3)))
    );
    await waitForEffects();

    expect(actor.getSnapshot().context).toBe(3);
    expect(actor.getSnapshot().status).toBe('done');
  });

  it('relays an Effect event stream to its parent', async () => {
    const machine = createMachine({
      context: { seen: 0 },
      schemas: { events: { VALUE: types<{ value: number }>() } },
      initial: 'active',
      states: {
        active: {
          invoke: {
            src: fromEffectEventStream(
              Stream.make(
                { type: 'VALUE', value: 1 },
                { type: 'VALUE', value: 2 }
              )
            )
          },
          on: {
            VALUE: {
              context: ({ context, event }) => ({
                seen: context.seen + event.value
              })
            }
          }
        }
      }
    });

    const actor = await Effect.runPromise(createEffectActor(machine));
    await waitForEffects();

    expect(actor.getSnapshot().context).toEqual({ seen: 3 });
  });

  it('interrupts a running Effect actor when it is stopped', async () => {
    let interrupted = false;
    const logic = fromEffect(
      Effect.ensuring(
        Effect.never,
        Effect.sync(() => {
          interrupted = true;
        })
      )
    );
    const actor = await Effect.runPromise(createEffectActor(logic));

    actor.stop();
    await waitForEffects();

    expect(interrupted).toBe(true);
    expect(actor.getSnapshot().status).toBe('stopped');
  });

  it('interrupts an invoked Effect actor when its state is exited', async () => {
    let interrupted = false;
    const worker = fromEffect(
      Effect.ensuring(
        Effect.never,
        Effect.sync(() => {
          interrupted = true;
        })
      )
    );
    const machine = setup({ actors: { worker } }).createMachine({
      context: {},
      initial: 'loading',
      states: {
        loading: {
          invoke: {
            src: 'worker'
          },
          on: {
            CANCEL: { target: 'cancelled' }
          }
        },
        cancelled: {}
      }
    });
    const actor = await Effect.runPromise(createEffectActor(machine));

    actor.send({ type: 'CANCEL' });
    await waitForEffects();

    expect(interrupted).toBe(true);
    expect(actor.getSnapshot().value).toBe('cancelled');
    actor.stop();
  });

  it('interrupts a running Effect action when its actor is stopped', async () => {
    let interrupted = false;
    const effectSetup = setupEffect({
      actions: {
        work: (_args) =>
          Effect.ensuring(
            Effect.never,
            Effect.sync(() => {
              interrupted = true;
            })
          )
      }
    });
    const machine = effectSetup.createMachine({
      initial: 'active',
      states: {
        active: {
          on: {
            WORK: (args, enq) => enq(args.actions.work, args)
          }
        }
      }
    });
    const actor = await Effect.runPromise(createEffectActor(machine));

    actor.send({ type: 'WORK' });
    actor.stop();
    await waitForEffects();

    expect(interrupted).toBe(true);
  });

  it('restarts an unkeyed Effect actor from persisted state', async () => {
    let runs = 0;
    const logic = fromEffect(() => {
      runs += 1;
      return Effect.never;
    });

    const actor = await Effect.runPromise(createEffectActor(logic));
    const persisted = actor.getPersistedSnapshot();
    actor.stop();

    const restoredActor = await Effect.runPromise(
      createEffectActor(logic, { snapshot: persisted })
    );

    expect(runs).toBe(2);
    restoredActor.stop();
  });
});
