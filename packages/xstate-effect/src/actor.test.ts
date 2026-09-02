import { Cause, Duration, Effect, Exit, Scope, Stream } from 'effect';
import { createMachine, types, type AnyActor } from 'xstate';
import {
  ActorStoppedError,
  createEffectActor,
  emitted,
  fromEffect,
  inspect,
  send,
  snapshots,
  toEffect,
  waitFor
} from './index.ts';

let scopes: Scope.Closeable[] = [];

afterEach(async () => {
  const pending = scopes;
  scopes = [];
  for (const scope of pending) {
    await Effect.runPromise(Scope.close(scope, Exit.void));
  }
});

/** Runs a scoped Effect in a scope that stays open until the test ends. */
const runScoped = async <A, E>(
  effect: Effect.Effect<A, E, Scope.Scope>
): Promise<A> => {
  const scope = await Effect.runPromise(Scope.make());
  scopes.push(scope);
  return Effect.runPromise(Scope.provide(effect, scope));
};

/**
 * Runs `drive` right after the API under test subscribes to the actor, so
 * tests never race the Effect scheduler with a timer.
 */
const afterSubscribe = (actor: AnyActor, drive: () => void): void => {
  const actorSubscribe = actor.subscribe.bind(actor);
  let driven = false;
  actor.subscribe = ((...args: Parameters<typeof actorSubscribe>) => {
    const subscription = actorSubscribe(...args);
    if (!driven) {
      driven = true;
      queueMicrotask(drive);
    }
    return subscription;
  }) as typeof actor.subscribe;
};

/** The `system.inspect` counterpart of {@link afterSubscribe}. */
const afterInspect = (actor: AnyActor, drive: () => void): void => {
  const systemInspect = actor.system.inspect.bind(actor.system);
  actor.system.inspect = ((observer: Parameters<typeof systemInspect>[0]) => {
    const subscription = systemInspect(observer);
    queueMicrotask(drive);
    return subscription;
  }) as typeof actor.system.inspect;
};

const counterMachine = createMachine({
  schemas: {
    events: {
      INCREMENT: types<{}>(),
      FINISH: types<{}>()
    }
  },
  context: { count: 0 },
  initial: 'counting',
  states: {
    counting: {
      on: {
        INCREMENT: ({ context }) => ({
          context: { count: context.count + 1 }
        }),
        FINISH: { target: 'finished' }
      }
    },
    finished: { type: 'final' }
  },
  output: ({ context }) => ({ count: context.count })
});

const emitterMachine = createMachine({
  initial: 'active',
  states: {
    active: {
      on: {
        PING: (_args, enq) => {
          enq.emit({ type: 'pinged' });
        }
      }
    }
  }
});

describe('send', () => {
  it('sends an event to the actor', async () => {
    await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(counterMachine);

        yield* send(actor, { type: 'INCREMENT' });
        yield* send(actor, { type: 'INCREMENT' });

        expect(actor.getSnapshot().context).toEqual({ count: 2 });
      })
    );
  });

  it('rejects events the actor cannot receive', async () => {
    await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(counterMachine);

        const sendUnknownEvent = () =>
          // @ts-expect-error -- the event type is derived from the actor
          send(actor, { type: 'UNKNOWN' });

        void sendUnknownEvent;
      })
    );
  });
});

describe('snapshots', () => {
  it('emits the current snapshot, then every change, and ends on completion', async () => {
    const collected = await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(counterMachine);
        afterSubscribe(actor, () => {
          actor.send({ type: 'INCREMENT' });
          actor.send({ type: 'FINISH' });
        });

        return yield* Stream.runCollect(snapshots(actor));
      })
    );

    expect(collected.map((snapshot) => snapshot.context.count)).toEqual([
      0, 1, 1
    ]);
    expect(collected.map((snapshot) => snapshot.status)).toEqual([
      'active',
      'active',
      'done'
    ]);
  });

  it('emits the error snapshot and ends when the actor errors', async () => {
    const failure = { code: 'BOOM' as const };
    const collected = await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(
          fromEffect(Effect.fail(failure).pipe(Effect.delay(10)))
        );

        return yield* Stream.runCollect(snapshots(actor));
      })
    );

    expect(collected.map((snapshot) => snapshot.status)).toEqual([
      'active',
      'error'
    ]);
    expect(collected[1].error).toEqual(failure);
  });

  it('unsubscribes from the actor when the stream is interrupted', async () => {
    let unsubscribed = 0;
    const collected = await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(counterMachine);
        const actorSubscribe = actor.subscribe.bind(actor);
        actor.subscribe = ((...args: Parameters<typeof actorSubscribe>) => {
          const subscription = actorSubscribe(...args);
          queueMicrotask(() => {
            actor.send({ type: 'INCREMENT' });
            actor.send({ type: 'INCREMENT' });
          });
          return {
            unsubscribe: () => {
              unsubscribed++;
              subscription.unsubscribe();
            }
          };
        }) as typeof actor.subscribe;

        return yield* Stream.runCollect(snapshots(actor).pipe(Stream.take(2)));
      })
    );

    expect(collected.map((snapshot) => snapshot.context.count)).toEqual([0, 1]);
    expect(unsubscribed).toBe(1);
  });
});

describe('emitted', () => {
  it('streams emitted events and ends when the actor stops', async () => {
    const collected = await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(emitterMachine);
        afterSubscribe(actor, () => {
          actor.send({ type: 'PING' });
          actor.send({ type: 'PING' });
          actor.stop();
        });

        return yield* Stream.runCollect(emitted(actor));
      })
    );

    expect(collected).toEqual([{ type: 'pinged' }, { type: 'pinged' }]);
  });
});

describe('waitFor', () => {
  it('resolves immediately when the current snapshot matches', async () => {
    const snapshot = await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(counterMachine);

        return yield* waitFor(actor, (state) => state.context.count === 0);
      })
    );

    expect(snapshot.context).toEqual({ count: 0 });
  });

  it('resolves on the first later snapshot that matches', async () => {
    const snapshot = await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(counterMachine);
        afterSubscribe(actor, () => {
          actor.send({ type: 'INCREMENT' });
          actor.send({ type: 'INCREMENT' });
        });

        return yield* waitFor(actor, (state) => state.context.count === 2);
      })
    );

    expect(snapshot.context).toEqual({ count: 2 });
  });

  it('fails with ActorStoppedError when the actor stops first', async () => {
    const error = await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(counterMachine);
        afterSubscribe(actor, () => {
          actor.stop();
        });

        return yield* Effect.flip(
          waitFor(actor, (state) => state.context.count === 10)
        );
      })
    );

    expect(error).toBeInstanceOf(ActorStoppedError);
    expect(error.message).toMatch(/stopped before completing/);
  });

  it('fails with TimeoutError when the timeout elapses', async () => {
    const error = await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(counterMachine);

        return yield* Effect.flip(
          waitFor(actor, (state) => state.context.count === 10, {
            timeout: Duration.millis(10)
          })
        );
      })
    );

    expect(Cause.isTimeoutError(error)).toBe(true);
  });
});

describe('toEffect', () => {
  it('succeeds with the actor output when it is done', async () => {
    const output = await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(counterMachine);
        afterSubscribe(actor, () => {
          actor.send({ type: 'INCREMENT' });
          actor.send({ type: 'FINISH' });
        });

        return yield* toEffect(actor);
      })
    );

    expect(output).toEqual({ count: 1 });
  });

  it('fails with the typed actor error', async () => {
    const failure = { code: 'X' as const };
    const error = await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(
          fromEffect(Effect.fail(failure).pipe(Effect.delay(10)))
        );

        return yield* Effect.flip(toEffect(actor));
      })
    );

    error satisfies { code: 'X' } | ActorStoppedError;
    expect(error).toEqual(failure);
  });

  it('fails with ActorStoppedError when the actor is stopped', async () => {
    const error = await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(counterMachine);
        afterSubscribe(actor, () => {
          actor.stop();
        });

        return yield* Effect.flip(toEffect(actor));
      })
    );

    expect(error).toBeInstanceOf(ActorStoppedError);
  });
});

describe('inspect', () => {
  it('streams inspection events from the actor system', async () => {
    const events = await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(counterMachine);
        afterInspect(actor, () => {
          actor.send({ type: 'INCREMENT' });
        });

        return yield* Stream.runCollect(inspect(actor).pipe(Stream.take(1)));
      })
    );

    expect(events.map((event) => event.type)).toEqual(['@xstate.transition']);
    expect(events[0]).toMatchObject({ event: { type: 'INCREMENT' } });
  });
});
