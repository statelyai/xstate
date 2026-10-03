---
title: "XState Effect: Testing and errors"
description: Test deadlines, recover from failures and supervise workflow actors.
---

Test the workflow with its real machine and provide local Effect services. Use `waitFor` for state assertions and `join` for final output.

## TestClock

A release approval expires after 30 seconds. `TestClock` drives the same `after` transition without waiting for real time:

<!-- example from examples/effect-workflows/src/clock.ts -->

```ts
import { Effect } from 'effect';
import { TestClock } from 'effect/testing';
import { createEffectActor, waitFor } from '@xstate/effect';
import { createMachine } from 'xstate';

const reviewMachine = createMachine({
  initial: 'pending',
  states: {
    pending: {
      after: { 30000: { target: 'expired' } },
      on: { APPROVE: { target: 'approved' } }
    },
    approved: { type: 'final' },
    expired: { type: 'final' }
  }
});

const test = Effect.gen(function* () {
  const actor = yield* createEffectActor(reviewMachine);
  yield* TestClock.adjust('30 seconds');
  const snapshot = yield* waitFor(actor, (s) => s.matches('expired'));
  return snapshot.value;
});

export const result = await Effect.runPromise(
  test.pipe(Effect.scoped, Effect.provide(TestClock.layer()))
);
console.log(result); // 'expired', with no 30-second wait
```

- Timers use Effect's `Clock`, including delayed sends.
- `waitFor` and `join` fail if the actor stops before reaching the expected result.
- Add `waitFor`'s `{ timeout }` to bound a wait. With `TestClock`, advance the clock to trigger that timeout too.
- Use `inspect` for execution traces and `deadLetters` for delivery failures.

XState's [path generation](../../../docs/model-based-testing.md) works on the machine itself. Execute generated paths against an actor from `createEffectActor`, or use `testPaths()` from `@xstate/test`.

## Retry a task

Use Effect's retry combinators inside `fromEffect` for transient failures within one task. This local publisher succeeds on its third attempt:

<!-- example from examples/effect-workflows/src/retry.ts -->

```ts
import { Effect, Schedule } from 'effect';
import { createEffectActor, fromEffect, join } from '@xstate/effect';

let attempts = 0;
const publish = fromEffect(
  Effect.suspend(() => {
    attempts++;
    return attempts < 3
      ? Effect.fail(new Error('Publisher temporarily unavailable'))
      : Effect.succeed('published');
  }).pipe(
    Effect.retry({ schedule: Schedule.exponential('10 millis'), times: 3 })
  )
);

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(publish);
  return yield* join(actor);
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result); // 'published', on attempt 3
```

Use a machine state when retry requires a person or an event. The [quick start](quick-start.md) accepts `RETRY` only after deployment fails.

## Supervise an actor

Retry a scoped unit when a failure should create a fresh actor:

<!-- example from examples/effect-workflows/src/supervision.ts -->

```ts
import { Effect, Schedule } from 'effect';
import { createEffectActor, fromEffect, join } from '@xstate/effect';

let attempts = 0;
const worker = fromEffect(
  Effect.suspend(() => {
    attempts++;
    return attempts < 3
      ? Effect.fail(new Error('Worker disconnected'))
      : Effect.succeed('complete');
  })
);

const attempt = Effect.gen(function* () {
  const actor = yield* createEffectActor(worker);
  return yield* join(actor);
});

// Each failed attempt closes its scope before a new actor starts.
const supervised = Effect.scoped(attempt).pipe(
  Effect.retry({ schedule: Schedule.exponential('10 millis'), times: 3 })
);

export const result = await Effect.runPromise(supervised);
console.log(result); // 'complete', from the third actor
```

Each attempt stops its actor and releases its resources before the next attempt starts.

<details>
<summary>Choosing failures to retry</summary>

`join` reports the actor's failure, so the retry policy sees that error. A machine's error type is `unknown`; narrow it if only some failures should be retried. Keep `Effect.scoped` inside the retry, so failed actors are released after each attempt.

Retrying can repeat external operations. Use stable operation IDs or idempotent APIs when repetition could create duplicate work.

</details>

## Handle typed failures

A `fromEffect` actor preserves its Effect's error type. Handle a domain failure with `Effect.catchTag`:

<!-- example from examples/effect-workflows/src/errors.ts -->

```ts
import { Data, Effect } from 'effect';
import { createEffectActor, fromEffect, join } from '@xstate/effect';

class PublishFailed extends Data.TaggedError('PublishFailed')<{
  readonly reason: string;
}> {}

const publish = fromEffect(
  Effect.fail(new PublishFailed({ reason: 'Release needs approval' }))
);

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(publish);
  return yield* join(actor).pipe(
    Effect.catchTag('PublishFailed', (error) => Effect.succeed(error.reason))
  );
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result); // 'Release needs approval'
```

For machine workflows, expected outcomes such as declined or expired can be final states with output. `join(machineActor)` has an `unknown` error channel for unexpected machine failures.

## Error reference

| Error | Raised by |
| --- | --- |
| `ActorStoppedError` | `waitFor` when the actor stops or errors before matching; `join` when it stops without output. |
| `EffectInterruptedError` | Effect logic that interrupts itself. |
| `Cause.TimeoutError` | `waitFor` with a timeout, or Effect's timeout combinators. |

- `ActorStoppedError` includes `actorId` and `snapshot`.
- `EffectInterruptedError` includes its interrupt `cause`.
- Both package errors are `Data.TaggedError` classes.
- An actor's own typed failure is available through `snapshot.error` and `join`; `ErrorFrom` names its type.

<details>
<summary>Observe root actor errors</summary>

A root Effect actor's error is a value. Read it with `join`, `waitFor`, `subscribe` or the `result` atom. An unobserved errored actor is silent, like a failed forked fiber.

</details>

## Persistence

`actor.getPersistedSnapshot()` records the actor's state. It does not record progress inside a running Effect: an Effect task or stream that was running when the snapshot was taken starts again from the beginning after a restore. See [persisting and restoring](actors.md#persisting-and-restoring).

## Tracing

Hosted Effects run inside spans:

| Span | Work |
| --- | --- |
| `fromEffect` | A task actor's Effect. |
| `fromEffectStream` | A stream of snapshot values. |
| `fromEffectEventStream` | A stream of parent events. |
| `action.<name>` | A declared Effect action. |

Spans carry `xstate.actor.id` and `xstate.actor.address`. The address is the actor's `/`-joined path from the root, identifying its place in the actor tree.

Provide a `Tracer` to record and export spans.
