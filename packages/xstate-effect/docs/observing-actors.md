---
title: "XState Effect: Observing actors"
description: Send events and observe workflow state, results and notifications.
---

Use these functions with an `EffectActor`, a child from `snapshot.children` or another XState actor reference.

| Function | Result |
| --- | --- |
| `send(actor, event)` | Enqueues an event as `Effect<void>`. |
| `snapshots(actor)` | Streams the current snapshot, then changes. |
| `waitFor(actor, predicate)` | Waits for a matching snapshot. |
| `join(actor)` | Waits for the actor's final output. |
| `emitted(actor)` | Streams emitted events. |
| `inspect(actor)` | Streams system inspection events. |
| `deadLetters(actor)` | Streams events the system could not deliver. |

## Send, observe and join

This example records a review's state changes and reads its final output:

<!-- example from examples/effect-workflows/src/observe.ts -->

```ts
import { Effect, Stream, pipe } from 'effect';
import {
  createEffectActor,
  join,
  send,
  snapshots,
  waitFor
} from '@xstate/effect';
import { createMachine } from 'xstate';

const reviewMachine = createMachine({
  output: () => ({ approved: true }),
  initial: 'pending',
  states: {
    pending: { on: { APPROVE: { target: 'approved' } } },
    approved: { type: 'final' }
  }
});

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(reviewMachine);
  const history = yield* snapshots(actor).pipe(
    // Send after the subscription sees the initial state.
    Stream.tap((s) =>
      s.matches('pending')
        ? pipe(actor, send({ type: 'APPROVE' }))
        : Effect.void
    ),
    Stream.map((s) => s.value),
    Stream.runCollect
  );
  yield* waitFor(actor, (s) => s.matches('approved'), { timeout: '5 seconds' });
  return { history: [...history], output: yield* join(actor) };
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result);
// { history: ['pending', 'approved'], output: { approved: true } }
```

- `send` enqueues an event; use `waitFor`, `snapshots` or `join` to observe the outcome.
- `send` and `waitFor` also support pipeable usage, as shown with `pipe(actor, send(...))`.
- `snapshots` begins with the current snapshot and ends when the actor completes or stops. An error snapshot is emitted before the stream ends.
- `waitFor` succeeds immediately if the current snapshot already matches. Its `{ timeout }` option bounds the wait.
- A type predicate passed to `waitFor` narrows the returned snapshot.
- `join` succeeds with `output` when the actor reaches `done`.

<details>
<summary>Wait and join failures</summary>

- `waitFor` fails with `ActorStoppedError` if the actor stops or errors before matching. Its timeout fails with Effect's `Cause.TimeoutError`.
- `join` fails with `snapshot.error` when the actor errors, or `ActorStoppedError` when it stops without output.
- `join` on `fromEffect` logic preserves the Effect's typed error. A machine's error type is `unknown`: actions can throw arbitrary values and unhandled child errors can fail the machine.
- Model expected domain outcomes as final states with output. Handle unexpected machine errors with `Effect.catch`, or use `Effect.orDie` to treat them as defects.

</details>

## Stream notifications

Use `emitted` for notifications sent with `enq.emit` or `EffectSourceArgs.emit`. This workflow emits a reminder every second while a review is pending:

<!-- example from examples/effect-workflows/src/emitted.ts -->

```ts
import { Effect, Schema, Stream } from 'effect';
import { createEffectActor, emitted, setupEffect } from '@xstate/effect';

const reminderMachine = setupEffect({
  schemas: {
    emitted: { reminder: Schema.Struct({ message: Schema.String }) }
  }
}).createMachine({
  initial: 'waiting',
  states: {
    waiting: { after: { 1000: { target: 'reminding' } } },
    reminding: {
      entry: (_, enq) =>
        enq.emit({ type: 'reminder', message: 'Review pending' }),
      after: { 0: { target: 'waiting' } }
    }
  }
});

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(reminderMachine);
  return [...(yield* emitted(actor).pipe(Stream.take(1), Stream.runCollect))];
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result); // [{ type: 'reminder', message: 'Review pending' }]
```

`Stream.take(1)` ends this consumer after one reminder. Use `Stream.runForEach` for a subscriber that handles ongoing notifications. Emitted events are not replayed; start the consumer before the events you need to observe.

`emitted` ends when the actor completes, errors or stops. Interrupting the consumer also ends it and removes its listener.

## Inspect execution

`inspect(actor)` streams [inspection events](../../../docs/inspection.md) for the actor's system. Use `Stream.runForEach(inspect(actor), ...)` to record actor creation and transitions. Start that consumer before the events you want to inspect, and keep it in the same scope as the actor.

For a visual inspector, forward `actor.inspect` events through the SDK's `actor`, `event` and `snapshot` methods, using session IDs to identify actors across execution steps. This demo uses the optional `INSPECT=1` flag and releases the subscription and inspector with its Effect scope:

<!-- example from examples/effect-workflows/src/inspection.ts -->

```ts
import { createInspector } from '@statelyai/sdk';
import { Effect } from 'effect';
import type { Snapshot } from 'xstate';
import {
  createEffectActor,
  fromEffect,
  join,
  send,
  setupEffect
} from '@xstate/effect';

const reviewMachine = setupEffect({
  actors: { publish: fromEffect(Effect.succeed('Release published')) }
}).createMachine({
  id: 'releaseReview',
  output: () => 'Release published',
  initial: 'awaitingApproval',
  states: {
    awaitingApproval: { on: { APPROVE: { target: 'publishing' } } },
    publishing: { invoke: { src: 'publish', onDone: { target: 'published' } } },
    published: { type: 'final' }
  }
});

// Keep wire snapshots JSON-safe; actor snapshots contain live child references.
const inspectorSnapshot = (snapshot: Snapshot<unknown>) => ({
  status: snapshot.status,
  ...('value' in snapshot ? { value: snapshot.value } : {})
});

export const program = Effect.gen(function* () {
  const inspector = yield* Effect.acquireRelease(
    Effect.sync(() =>
      process.env.INSPECT === '1' ? createInspector() : undefined
    ),
    (inspector) => Effect.sync(() => inspector?.destroy())
  );
  const actor = yield* createEffectActor(reviewMachine);
  if (inspector) {
    inspector.actor(actor.sessionId!, {
      machine: reviewMachine.config,
      snapshot: inspectorSnapshot(actor.getSnapshot())
    });
    yield* Effect.acquireRelease(
      Effect.sync(() =>
        actor.inspect((event) => {
          // Session IDs stay stable across Effect's pure execution steps.
          const id = event.actorRef.sessionId!;
          if (event.type === '@xstate.actor') {
            inspector.actor(id, {
              parent: event.parentRef?.sessionId,
              snapshot: inspectorSnapshot(event.snapshot)
            });
          } else {
            inspector.event(id, event.event, {
              source: event.sourceRef?.sessionId
            });
            inspector.snapshot(
              id,
              inspectorSnapshot(event.snapshot),
              event.event
            );
            if (event.snapshot.status !== 'active') inspector.stop(id);
          }
        })
      ),
      (subscription) => Effect.sync(() => subscription.unsubscribe())
    );
    // Let the inspector connect before the demo sends its first event.
    yield* Effect.promise(() => inspector.ready);
  }
  yield* send(actor, { type: 'APPROVE' });
  return yield* join(actor);
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result); // 'Release published'
```

Set `INSPECT=1` when running the program to open the Stately inspector and send machine definitions, snapshots and events to its hosted relay. Without the flag, the demo runs locally.

## Dead letters

Observe `deadLetters` to diagnose delivery failures. For example, run `Stream.runForEach(deadLetters(actor), (rejection) => Effect.logWarning(rejection))` in a scoped fiber while the actor is in use.

Each rejection includes the event and a reason:

- `stopped`: the target has stopped;
- `invalidEvent`: the payload failed the target's runtime schema validation;
- `internalEvent`: an internal event was sent from outside its owning actor.

A delivered event can still have no transition in the current state. Dead letters describe delivery, not whether the workflow changed state.

<details>
<summary>Why send does not fail</summary>

`send` has no typed failures. A dead letter is reported through `system.onRejectedEvent`, separately from actor errors and inspection events. `deadLetters` removes that listener when the stream ends.

</details>
