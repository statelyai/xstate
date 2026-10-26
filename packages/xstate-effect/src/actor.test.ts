import { expectTypeOf } from 'vitest';
import { Cause, Duration, Effect, Exit, Fiber, Scope, Stream } from 'effect';
import {
  createMachine,
  types,
  type AnyActorRef,
  type SnapshotFrom
} from 'xstate';
import {
  ActorStoppedError,
  EffectActor,
  EffectFailure,
  createEffectActor,
  emitted,
  createEffectLogic,
  inspect,
  send,
  snapshots,
  join,
  waitFor
} from './index.ts';

/**
 * Polls until `predicate` holds. The actor processes events on its own fiber,
 * so tests wait for the condition they assert on.
 */
const until = async (predicate: () => boolean, timeoutMs = 1000) => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
};

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
const afterSubscribe = (actor: AnyActorRef, drive: () => void): void => {
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

/** The `actor.inspect` counterpart of {@link afterSubscribe}. */
const afterInspect = (actor: EffectActor<any>, drive: () => void): void => {
  const actorInspect = actor.inspect.bind(actor);
  actor.inspect = ((observer: Parameters<typeof actorInspect>[0]) => {
    const subscription = actorInspect(observer);
    queueMicrotask(drive);
    return subscription;
  }) as typeof actor.inspect;
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

type CounterSnapshot = SnapshotFrom<typeof counterMachine>;
type DoneCounterSnapshot = CounterSnapshot & { status: 'done' };

/** A type-predicate predicate, so `waitFor` narrows what it resolves with. */
const isDone = (snapshot: CounterSnapshot): snapshot is DoneCounterSnapshot =>
  snapshot.status === 'done';

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
        yield* waitFor(actor, (state) => state.context.count === 2);

        expect(actor.getSnapshot().context).toEqual({ count: 2 });
      })
    );
  });

  it('accepts the data-last form', async () => {
    await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(counterMachine);

        yield* send({ type: 'INCREMENT' } as const)(actor);
        yield* waitFor(actor, (state) => state.context.count === 1);

        expect(actor.getSnapshot().context).toEqual({ count: 1 });
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
          createEffectLogic(Effect.fail(failure).pipe(Effect.delay(10)))
        );

        return yield* Stream.runCollect(snapshots(actor));
      })
    );

    expect(collected.map((snapshot) => snapshot.status)).toEqual([
      'active',
      'error'
    ]);
    expect(collected[1].error).toBeInstanceOf(EffectFailure);
    expect(Cause.squash(collected[1].error!.cause)).toEqual(failure);
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
    const collected: unknown[] = [];
    await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(emitterMachine);
        let listening = false;
        const actorOn = actor.on.bind(actor);
        actor.on = ((...args: Parameters<typeof actorOn>) => {
          listening = true;
          return actorOn(...args);
        }) as typeof actor.on;

        const fiber = yield* Effect.forkScoped(
          Stream.runForEach(emitted(actor), (event) =>
            Effect.sync(() => {
              collected.push(event);
            })
          )
        );
        yield* Effect.promise(() => until(() => listening));

        actor.send({ type: 'PING' });
        actor.send({ type: 'PING' });
        yield* Effect.promise(() => until(() => collected.length === 2));

        actor.stop();
        yield* Fiber.join(fiber);
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

  it('accepts the data-last form', async () => {
    const snapshot = await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(counterMachine);
        afterSubscribe(actor, () => {
          actor.send({ type: 'INCREMENT' });
        });

        return yield* waitFor(
          (state: CounterSnapshot) => state.context.count === 1
        )(actor);
      })
    );

    expect(snapshot.context).toEqual({ count: 1 });
  });

  it('narrows the snapshot with a type-predicate predicate', async () => {
    const snapshot = await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(counterMachine);
        afterSubscribe(actor, () => {
          actor.send({ type: 'FINISH' });
        });

        return yield* waitFor(actor, isDone);
      })
    );

    snapshot satisfies { status: 'done' };
    expect(snapshot.output).toEqual({ count: 0 });
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

describe('join', () => {
  it('succeeds with the actor output when it is done', async () => {
    const output = await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(counterMachine);
        afterSubscribe(actor, () => {
          actor.send({ type: 'INCREMENT' });
          actor.send({ type: 'FINISH' });
        });

        return yield* join(actor);
      })
    );

    expect(output).toEqual({ count: 1 });
  });

  it('fails with the typed actor error', async () => {
    const failure = { code: 'X' as const };
    const error = await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(
          createEffectLogic(Effect.fail(failure).pipe(Effect.delay(10)))
        );

        return yield* Effect.flip(join(actor));
      })
    );

    error satisfies { code: 'X' } | ActorStoppedError;
    expect(error).toEqual(failure);
  });

  it('exposes machine errors as unknown and preserves the thrown value', async () => {
    const failure = { code: 'MACHINE_FAILURE' };
    const machine = createMachine({
      on: {
        FAIL: () => {
          throw failure;
        }
      }
    });
    const error = await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(machine);
        const result = join(actor);
        expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<unknown>();
        afterSubscribe(actor, () => actor.send({ type: 'FAIL' }));
        return yield* Effect.flip(result);
      })
    );

    expect(error).toBe(failure);
  });

  it('fails with ActorStoppedError when the actor is stopped', async () => {
    const error = await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(counterMachine);
        afterSubscribe(actor, () => {
          actor.stop();
        });

        return yield* Effect.flip(join(actor));
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

describe('original Effect Causes', () => {
  it.each([
    Cause.fail('failed'),
    Cause.die(new Error('defect')),
    Cause.interrupt(123),
    Cause.combine(Cause.fail('first'), Cause.die('second'))
  ])('replays a task Cause without squashing', async (cause) => {
    const actor = await runScoped(
      createEffectActor(createEffectLogic(Effect.failCause(cause)))
    );
    const exit = await Effect.runPromise(Effect.exit(join(actor)));
    expect(Exit.isFailure(exit) && exit.cause).toBe(
      actor.getSnapshot().error!.cause
    );
    expect(Exit.isFailure(exit) && exit.cause.reasons).toMatchObject(
      cause.reasons.map(({ annotations, ...reason }) => reason)
    );
  });

  it('captures a throwing source factory as a defect', async () => {
    const defect = new Error('source factory');
    const actor = await runScoped(
      createEffectActor(
        createEffectLogic(() => {
          throw defect;
        })
      )
    );
    const exit = await Effect.runPromise(Effect.exit(join(actor)));
    expect(Exit.isFailure(exit) && exit.cause.reasons).toMatchObject([
      { _tag: 'Die', defect }
    ]);
  });

  it('does not interpret a similarly tagged domain error as a Cause wrapper', async () => {
    const error = { _tag: 'EffectFailure', cause: Cause.die('unrelated') };
    const { createActor, createStepLogic } = await import('xstate');
    const actor = createActor(
      createStepLogic({
        context: undefined,
        run: () => ({ status: 'error', error })
      })
    );
    actor.subscribe({ error: () => {} });
    const result = Effect.runPromise(Effect.flip(join(actor)));
    actor.start();
    expect(await result).toBe(error);
  });
});

it('restores genuine failed task snapshots and rejects serialized failure wrappers', async () => {
  const cause = Cause.die(new Error('defect'));
  const logic = createEffectLogic(Effect.failCause(cause));
  const actor = await runScoped(createEffectActor(logic));
  expect(
    Exit.isFailure(await Effect.runPromise(Effect.exit(join(actor))))
  ).toBe(true);
  const persisted = actor.getPersistedSnapshot();
  const live = await runScoped(
    createEffectActor(logic, { snapshot: persisted })
  );
  const exit = await Effect.runPromise(Effect.exit(join(live)));
  expect(Exit.isFailure(exit) && exit.cause).toBe(
    actor.getSnapshot().error!.cause
  );
  const json = JSON.parse(JSON.stringify(persisted));
  const restored = await Effect.runPromise(
    Effect.exit(Effect.scoped(createEffectActor(logic, { snapshot: json })))
  );
  expect(Exit.isFailure(restored) && Cause.hasDies(restored.cause)).toBe(true);
});
