---
title: Observing actors
description: Send events and read snapshots, output and emitted events as Effects.
---

The actor functions are free functions that take any XState actor reference, including the `EffectActor` handle, children read from `snapshot.children`, and actors created outside this package. A bundler drops the ones a program does not import.

| Function | Returns |
| --- | --- |
| `send(actor, event)` | `Effect<void>` |
| `snapshots(actor)` | `Stream<Snapshot>`: the current snapshot, then each change |
| `emitted(actor)` | `Stream<Emitted>`: events emitted with `emit` |
| `waitFor(actor, predicate)` | `Effect<Snapshot, ActorStoppedError>` |
| `waitFor(actor, predicate, { timeout })` | `Effect<Snapshot, ActorStoppedError \| Cause.TimeoutError>` |
| `join(actor)` | `Effect<Output, ErrorFrom<TLogic> \| ActorStoppedError>` |
| `inspect(actor)` | `Stream<InspectionEvent>` |
| `deadLetters(actor)` | `Stream<DeadLetterInspectionEvent>` |

## Dual usage

`send` and `waitFor` are dual: each takes the actor as its first argument, or returns a function of the actor so it can be piped.

```ts
yield* send(actor, { type: 'PAY' });
yield* pipe(actor, send({ type: 'PAY' }));
```

## Send

`send` returns `Effect<void>` and never fails. It enqueues the event the way `actor.send(event)` does, and the actor's fiber processes it. The event has not been processed when the Effect completes, so assert on the result with `waitFor`, `join` or `snapshots`.

## Wait for a snapshot

`waitFor` succeeds with the first snapshot that satisfies the predicate, and succeeds immediately when the current snapshot already does. It fails with `ActorStoppedError` when the actor stops or errors first. Interrupting it unsubscribes from the actor.

Pass `{ timeout }` to bound the wait. The failure is Effect's `Cause.TimeoutError`, not the `TimeoutError` that `xstate` exports for its own delayed-transition errors.

```ts
const snapshot = yield* waitFor(actor, (s) => s.matches('paid'), {
  timeout: '5 seconds'
});
```

When the predicate is a type predicate, `waitFor` narrows its result to the asserted snapshot type:

```ts
const done = yield* waitFor(
  actor,
  (s): s is typeof s & { status: 'done' } => s.status === 'done'
);
```

## Join the final result

`join` behaves like `Fiber.join`. It succeeds with the actor's `output` when the actor is done, fails with `snapshot.error` when the actor errors, and fails with `ActorStoppedError` when the actor stops without output. It waits for a still-active actor to settle.

The type of `snapshot.error` is `ErrorFrom<TLogic>`. For `fromEffect` logic that is the Effect's `E`. For a machine it is `unknown`, because an action can throw an arbitrary value or an unhandled child error can fail the machine, so `join(machineActor)` has `unknown` in its error channel. Model domain failures as final states and read them from the machine's output; treat a machine-level error as a defect with `Effect.orDie`, or handle it with `Effect.catch`, to keep the rest of the program typed.

```ts
const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(fetchUser, { input: { id: '42' } });
  const user = yield* join(actor);
  return user.id;
});
```

## Streams

`snapshots` starts with the current snapshot and then emits each change. It ends when the actor completes or stops, and emits the error snapshot before ending when the actor errors.

`emitted` streams every event the actor emits, as delivered to `actor.on('*', ...)`. See [emitted events](../emitted-events.md).

`inspect` streams the [inspection events](../inspection.md) of the actor's system: every transition, event delivery and dead letter of the execution. Both streams run until they are interrupted or their scope closes, and interrupting either removes the listener.

## Dead letters

XState reports an event the system could not deliver as a **dead letter** with a reason: `'stopped'` for a send to a stopped actor, `'invalidEvent'` for a payload the target's schema rejects, and `'internalEvent'` for an internal event type sent from outside its owning actor. A dead letter is not an actor error, and `send` cannot fail, so observe dead letters instead of relying on a failed send.

```ts
const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(machine);
  yield* Effect.forkScoped(
    Stream.runForEach(deadLetters(actor), (event) =>
      Effect.logWarning(`undelivered ${event.event.type}: ${event.reason}`)
    )
  );
  return actor;
});
```

`deadLetters` is `inspect` filtered to `@xstate.deadLetter` events.
