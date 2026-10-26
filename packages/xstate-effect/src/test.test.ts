import { Cause, Effect, Exit, Fiber, Schema, Scope } from 'effect';
import { testPaths } from '@xstate/test';
import { createMachine, setup } from 'xstate';
import { standardSchemaValidator } from 'xstate/validation';
import {
  ActorStoppedError,
  createEffectActor,
  createEffectLogic,
  join,
  setupEffect
} from './index.ts';
import { sendAndAwait } from './test.ts';

const counter = createMachine({
  context: { count: 0 },
  on: { INC: ({ context }) => ({ context: { count: context.count + 1 } }) }
});

const scoped = <A, E>(program: Effect.Effect<A, E, Scope.Scope>) =>
  Effect.runPromise(Effect.scoped(program));

it('acknowledges ignored events and each send of the same object independently', async () => {
  await scoped(
    Effect.gen(function* () {
      const actor = yield* createEffectActor(counter);
      const initial = actor.getSnapshot();
      const ignored = yield* sendAndAwait(actor, { type: 'IGNORED' });
      expect(ignored).toBe(initial);
      const event = { type: 'INC' };
      const snapshots = yield* Effect.all(
        Array.from({ length: 10 }, () => sendAndAwait(actor, event)),
        { concurrency: 'unbounded' }
      );
      expect(snapshots.map((snapshot) => snapshot.context.count)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10
      ]);
    })
  );
});

it('includes raised internal events and schedules work without waiting for background completion', async () => {
  let actionStarted = false;
  const machine = setupEffect({
    actions: {
      work: (_args: { self: unknown }) =>
        Effect.sync(() => {
          actionStarted = true;
        }).pipe(Effect.andThen(Effect.never))
    }
  }).createMachine({
    context: { count: 0 },
    on: {
      INC: (args, enq) => {
        enq.raise({ type: 'INTERNAL' });
        enq(args.actions.work, args);
      },
      INTERNAL: ({ context }) => ({ context: { count: context.count + 1 } })
    }
  });
  await scoped(
    Effect.gen(function* () {
      const actor = yield* createEffectActor(machine);
      const snapshot = yield* sendAndAwait(actor, { type: 'INC' });
      expect(snapshot.context.count).toBe(1);
      expect(actionStarted).toBe(true);
    })
  );
});

it('returns the snapshot for an event that completes the actor and rejects later queued sends', async () => {
  const machine = createMachine({
    initial: 'idle',
    states: {
      idle: { on: { FINISH: () => ({ target: 'done' }) } },
      done: { type: 'final' }
    }
  });
  await scoped(
    Effect.gen(function* () {
      const actor = yield* createEffectActor(machine);
      const [final, later] = yield* Effect.all(
        [
          sendAndAwait(actor, { type: 'FINISH' }),
          Effect.exit(sendAndAwait(actor, { type: 'FINISH' }))
        ],
        { concurrency: 'unbounded' }
      );
      expect(final.status).toBe('done');
      expect(Exit.isFailure(later) && Cause.squash(later.cause)).toBeInstanceOf(
        ActorStoppedError
      );
    })
  );
});

it('returns a terminal snapshot for a transition throw; join owns its failure', async () => {
  const error = new Error('transition');
  const machine = createMachine({
    on: {
      FAIL: () => {
        throw error;
      }
    }
  });
  await scoped(
    Effect.gen(function* () {
      const actor = yield* createEffectActor(machine);
      const snapshot = yield* sendAndAwait(actor, { type: 'FAIL' });
      expect(snapshot.status).toBe('error');
      expect(snapshot.error).toBe(error);
      expect(yield* Effect.flip(join(actor))).toBe(error);
    })
  );
});

it('reports invalid and internal events as exact delivery rejections', async () => {
  const machine = setupEffect({
    validator: standardSchemaValidator(),
    schemas: {
      events: { ADD: Schema.Struct({ delta: Schema.Number }) },
      internalEvents: { SECRET: Schema.Struct({}) }
    }
  }).createMachine({});
  await scoped(
    Effect.gen(function* () {
      const actor = yield* createEffectActor(machine);
      const invalid = { type: 'ADD', delta: 'bad' } as unknown as {
        type: 'ADD';
        delta: number;
      };
      expect(yield* Effect.flip(sendAndAwait(actor, invalid))).toMatchObject({
        _tag: 'EventRejectedError',
        reason: 'invalidEvent'
      });
      expect(
        yield* Effect.flip(sendAndAwait(actor, { type: 'SECRET' } as never))
      ).toMatchObject({ _tag: 'EventRejectedError', reason: 'internalEvent' });
      expect(
        (yield* sendAndAwait(actor, { type: 'ADD', delta: 1 })).status
      ).toBe('active');
    })
  );
});

it('rejects all queued receipts on stop', async () => {
  await scoped(
    Effect.gen(function* () {
      const actor = yield* createEffectActor(counter);
      const fibers = yield* Effect.sync(() => {
        const pending = Array.from({ length: 3 }, () =>
          Effect.runFork(sendAndAwait(actor, { type: 'INC' }))
        );
        actor.stop();
        return pending;
      });
      for (const fiber of fibers) {
        const exit = yield* Fiber.await(fiber);
        expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBeInstanceOf(
          ActorStoppedError
        );
      }
    })
  );
});

it('does not overwrite a reentrant observer stop or resolve its receipt twice', async () => {
  await scoped(
    Effect.gen(function* () {
      const actor = yield* createEffectActor(counter);
      actor.subscribe({
        next: (snapshot) => {
          if (snapshot.context.count === 1) actor.stop();
        }
      });
      expect(
        yield* Effect.flip(sendAndAwait(actor, { type: 'INC' }))
      ).toBeInstanceOf(ActorStoppedError);
      expect(actor.getSnapshot().status).toBe('stopped');
    })
  );
});

it('detaches an interrupted waiter while keeping its already sent event', async () => {
  await scoped(
    Effect.gen(function* () {
      const actor = yield* createEffectActor(counter);
      const fiber = yield* Effect.sync(() => {
        const pending = Effect.runFork(sendAndAwait(actor, { type: 'INC' }));
        pending.interruptUnsafe();
        return pending;
      });
      const snapshot = yield* sendAndAwait(actor, { type: 'IGNORED' });
      expect(snapshot.context.count).toBe(1);
      const exit = yield* Fiber.await(fiber);
      expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(
        true
      );
    })
  );
});

it('decodes transformed input and events before synchronous runtime validation', async () => {
  const Input = Schema.Struct({ count: Schema.NumberFromString });
  const Event = Schema.Struct({
    type: Schema.Literal('ADD'),
    delta: Schema.NumberFromString
  });
  const machine = setupEffect({
    validator: standardSchemaValidator(),
    schemas: {
      input: Schema.toType(Input),
      events: { ADD: Schema.Struct({ delta: Schema.Number }) }
    }
  }).createMachine({
    context: ({ input }) => ({ count: input.count }),
    on: {
      ADD: ({ context, event }) => ({
        context: { count: context.count + event.delta }
      })
    }
  });
  await scoped(
    Effect.gen(function* () {
      const input = yield* Schema.decodeUnknownEffect(Input)({ count: '2' });
      const actor = yield* createEffectActor(machine, { input });
      const event = yield* Schema.decodeUnknownEffect(Event)({
        type: 'ADD',
        delta: '3'
      });
      expect((yield* sendAndAwait(actor, event)).context.count).toBe(5);
    })
  );
});

it('serves @xstate/test through its existing async SUT session', async () => {
  const machine = createMachine({
    initial: 'idle',
    states: {
      idle: { on: { GO: () => ({ target: 'done' }) } },
      done: { type: 'final' }
    }
  });
  const result = await testPaths(machine, {
    sut: {
      create: async () => {
        const scope = await Effect.runPromise(Scope.make());
        const actor = await Effect.runPromise(
          Scope.provide(createEffectActor(machine), scope)
        );
        return {
          send: (event) =>
            Effect.runPromise(sendAndAwait(actor, event)).then(() => {}),
          read: () => actor.getSnapshot().value,
          dispose: () => Effect.runPromise(Scope.close(scope, Exit.void))
        };
      },
      projectModel: (snapshot) => snapshot.value
    }
  });
  expect(result.results.length).toBeGreaterThan(0);
});

it('rejects pending receipts when the owning scope closes', async () => {
  const scope = await Effect.runPromise(Scope.make());
  const actor = await Effect.runPromise(
    Scope.provide(createEffectActor(counter), scope)
  );
  const pending = Effect.runFork(sendAndAwait(actor, { type: 'INC' }));
  const closed = Effect.runFork(Scope.close(scope, Exit.void));
  const exit = await Effect.runPromise(Fiber.await(pending));
  await Effect.runPromise(Fiber.join(closed));
  expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBeInstanceOf(
    ActorStoppedError
  );
});

it('settles receipts queued before failed initialization finishes', async () => {
  await scoped(
    Effect.gen(function* () {
      const actor = yield* createEffectActor(
        createEffectLogic(Effect.die('initial failure'))
      );
      const result = yield* Effect.exit(
        sendAndAwait(actor, { type: 'IGNORED' })
      );
      expect(
        Exit.isFailure(result) && Cause.squash(result.cause)
      ).toBeInstanceOf(ActorStoppedError);
      expect(actor.getSnapshot().status).toBe('error');
    })
  );
});

it('settles a final event receipt if a completion observer stops reentrantly', async () => {
  const machine = createMachine({
    initial: 'idle',
    states: {
      idle: { on: { FINISH: () => ({ target: 'done' }) } },
      done: { type: 'final' }
    }
  });
  await scoped(
    Effect.gen(function* () {
      const actor = yield* createEffectActor(machine);
      actor.subscribe({
        next: (snapshot) => {
          if (snapshot.status === 'done') actor.stop();
        }
      });
      const result = yield* Effect.exit(
        sendAndAwait(actor, { type: 'FINISH' })
      );
      expect(
        Exit.isFailure(result) && Cause.squash(result.cause)
      ).toBeInstanceOf(ActorStoppedError);
    })
  );
});

it('does not mistake a rejected outgoing send for rejection of the incoming event', async () => {
  const machine = createMachine({
    on: { GO: (_args, enq) => enq.sendTo(undefined, { type: 'OUTGOING' }) }
  });
  await scoped(
    Effect.gen(function* () {
      const actor = yield* createEffectActor(machine);
      expect((yield* sendAndAwait(actor, { type: 'GO' })).status).toBe(
        'active'
      );
    })
  );
});
