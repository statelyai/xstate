---
title: Testing and errors
description: Drive actors with TestClock, supervise them, and read their failures.
---

Machines keep their normal [test surface](../testing.md), and this package adds Effect-native ways to drive and observe them.

## TestClock

Delays run on the Effect `Clock`, so `TestClock` advances `after` transitions and delayed sends without real time passing.

```ts
import { Effect } from 'effect';
import { TestClock } from 'effect/testing';
import { createEffectActor, waitFor } from '@xstate/effect';

const test = Effect.gen(function* () {
  const actor = yield* createEffectActor(machine);
  yield* TestClock.adjust('30 seconds');
  yield* waitFor(actor, (s) => s.matches('timedOut'));
});

await Effect.runPromise(
  test.pipe(Effect.scoped, Effect.provide(TestClock.layer()))
);
```

Assert with `waitFor` for a state the actor should reach, and with `join` for the actor's final output. Both fail rather than hang when the actor stops first, and `waitFor`'s `timeout` option bounds a test that would otherwise wait forever.

Observe with `inspect` for every inspection event and `deadLetters` for events the system could not deliver. A test that ends with no dead letters confirms that every event it sent was accepted.

Path generation in `xstate/graph` (`getShortestPaths`, `getSimplePaths`, `createTestModel`) operates on the machine, not on a running actor, so it works on an Effect-backed machine unchanged. Execute the generated paths against an actor from `createEffectActor`.

## Retries and supervision

Write retries with Effect's own combinators inside the logic. `fromEffect` adds no retry options.

```ts
const loadUser = fromEffect(({ input }: EffectSourceArgs<{ id: string }>) =>
  Api.use((api) => api.fetchUser(input.id)).pipe(
    Effect.retry({ schedule: Schedule.exponential('100 millis'), times: 3 })
  )
);
```

`createEffectActor` is an ordinary scoped Effect, so Effect's retry combinators also supervise a whole actor. Wrap the actor and the work that depends on it in `Effect.scoped`, then retry that unit. Each attempt builds a fresh actor, and the failed attempt's actor is stopped when its scope closes.

```ts
import { Effect, Schedule } from 'effect';
import { createEffectActor, join } from '@xstate/effect';

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(machine);
  return yield* join(actor);
});

const supervised = Effect.retry(Effect.scoped(program), {
  schedule: Schedule.exponential('100 millis'),
  times: 3
});
```

`join` fails with the machine's typed error, so the schedule sees the actual failure. Retrying `program` without `Effect.scoped` would reuse the outer scope and leak the actors from failed attempts until that scope closes.

## Errors

| Error | Raised by | Fields |
| --- | --- | --- |
| `ActorStoppedError` | `waitFor`, `join` when the actor stops or errors before the awaited result | `actorId: string`, `snapshot: Snapshot<unknown>` |
| `EffectInterruptedError` | Effect logic interrupted from inside, such as `Effect.interrupt`, reported as `snapshot.error` | `cause: Cause.Cause<never>` |
| `Cause.TimeoutError` | `waitFor` with `{ timeout }` when no snapshot matches in time | Effect's own error, `_tag: 'TimeoutError'` |

Both package errors are `Data.TaggedError` classes, so `Effect.catchTag('ActorStoppedError', ...)` matches them.

The actor's own failures are not in this table. A `fromEffect` actor reports the Effect's `E` value as `snapshot.error`, typed through `ErrorFrom`, which this package re-exports from `xstate`.

A root actor that errors does not throw globally the way `createActor(...).start()` does. Its error is a value: read it with `join`, `waitFor`, the [`result` atom](atoms-and-react.md#result) or `subscribe`. An errored actor that nobody observes is silent, like a failed forked fiber.

## Persistence

`actor.getPersistedSnapshot()` returns a serializable snapshot of the actor's state, as described in [persist and restore actors](../persist-and-restore-actors.md). It records state, not the progress of a running Effect.

Restoring a snapshot into a new interpreter is not supported yet. The durable execution loop this package is built on is the intended path for that, and it is the next piece of work.

## Tracing

Every Effect the actor hosts runs inside a span.

| Span | Covers |
| --- | --- |
| `fromEffect` | a `fromEffect` actor's Effect |
| `fromEffectStream` | a `fromEffectStream` actor's stream |
| `fromEffectEventStream` | a `fromEffectEventStream` actor's stream |
| `action.<name>` | an Effect action registered as `<name>` |

Each span carries the attributes `xstate.actor.id` and `xstate.actor.address`. `id` is the actor's own name. `address` is its `/`-joined path of ids from the root actor, which is stable across persistence and restore, so it identifies the same logical actor across runs.

Spans are recorded only when a `Tracer` is provided. Without one they cost nothing and export nothing.
