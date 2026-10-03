---
title: "XState Effect: Actors"
description: Create actors whose lifetime and dependencies belong to an Effect application.
---

`createEffectActor(logic, options?)` starts an actor and returns its handle as a scoped Effect.

- Pass `options.input` when the logic requires input.
- Pass `options.snapshot` to resume an actor from a persisted snapshot. See [persisting and restoring](#persisting-and-restoring).
- Provide the services required by its declared actions and child actors.
- Use `Effect.scoped` for a bounded program, or a Layer for an application service.

The [quick start](quick-start.md) shows an actor with input and a deployment service.

## Lifetime

The enclosing scope owns the actor. When that scope closes, the actor stops and its hosted Effects are interrupted.

- `Effect.scoped(program)` closes the scope when `program` finishes.
- `actor.stop()` stops the actor explicitly.
- Tasks created with `fromEffect`, `fromEffectStream` and `fromEffectEventStream` have their own scopes. Their resources are released when the task completes, fails or is interrupted.
- Background Effect actions use the owning actor's scope. Their resources are released when that actor stops.
- Use `withActorScope` around a resource acquisition to keep it until the owning actor stops.
- The enclosing scope waits for the actor's finalizers before finishing its own cleanup.

Provide application Layers outside `Effect.scoped`, with `program.pipe(Effect.scoped, Effect.provide(AppLayer))`, so services remain available while actor cleanup runs.

### Resource lifetimes

This release task owns a temporary workspace and opens a cache for the rest of the workflow. The workspace closes before the machine handles `onDone`; the cache closes when the owning actor stops.

<!-- example from examples/effect-workflows/src/resources.ts -->

```ts
import { Effect } from 'effect';
import {
  createEffectActor,
  fromEffect,
  waitFor,
  withActorScope
} from '@xstate/effect';
import { setup } from 'xstate';

const events: string[] = [];
const prepareRelease = fromEffect(
  Effect.gen(function* () {
    // Keep the shared cache open for the rest of the release workflow.
    yield* Effect.acquireRelease(
      Effect.succeed({ name: 'release-cache' }),
      () => Effect.sync(() => events.push('close cache'))
    ).pipe(withActorScope);

    // This temporary workspace belongs to this invocation.
    yield* Effect.acquireRelease(
      Effect.succeed({ directory: '/tmp/release' }),
      () => Effect.sync(() => events.push('remove workspace'))
    );
    events.push('prepare release');
    return 'artifact ready';
  })
);

const releaseMachine = setup({ actors: { prepareRelease } }).createMachine({
  initial: 'preparing',
  states: {
    preparing: {
      invoke: { src: 'prepareRelease', onDone: { target: 'ready' } }
    },
    ready: {}
  }
});

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(releaseMachine);
  yield* waitFor(actor, (snapshot) => snapshot.matches('ready'));
  events.push('ready for approval');
  // The workspace is gone; the cache stays open while the actor is alive.
});

await Effect.runPromise(Effect.scoped(program));
export const result = events;
console.log(result);
// ['prepare release', 'remove workspace', 'ready for approval', 'close cache']
```

The resource objects in this demo are local stand-ins. Replace their acquisition and release Effects with your file, connection or subscription APIs.

`withActorScope` uses the scope of the root actor created by `createEffectActor`, including when called from a nested invocation. Apply it to the acquisition whose lifetime you want to extend.

## Provide an actor as a service

Use `Layer.effect` to share one actor across requests. This review actor stays alive across calls to the `ManagedRuntime`:

<!-- example from examples/effect-workflows/src/actor-service.ts -->

```ts
import { Context, Effect, Layer, ManagedRuntime } from 'effect';
import {
  createEffectActor,
  send,
  waitFor,
  type EffectActor
} from '@xstate/effect';
import { createMachine } from 'xstate';

const reviewMachine = createMachine({
  initial: 'pending',
  states: {
    pending: { on: { APPROVE: { target: 'approved' } } },
    approved: {}
  }
});

class ReviewActor extends Context.Service<
  ReviewActor,
  EffectActor<typeof reviewMachine>
>()('@app/ReviewActor') {}

const ReviewActorLayer = Layer.effect(
  ReviewActor,
  createEffectActor(reviewMachine)
);
const runtime = ManagedRuntime.make(ReviewActorLayer);

try {
  const snapshot = await runtime.runPromise(
    Effect.gen(function* () {
      const actor = yield* ReviewActor;
      yield* send(actor, { type: 'APPROVE' });
      return yield* waitFor(actor, (s) => s.matches('approved'));
    })
  );
  console.log(snapshot.value); // 'approved'
} finally {
  await runtime.dispose();
}
```

- The Layer starts the actor when it is built.
- `EffectActor<typeof reviewMachine>` types the service and its events.
- `runtime.dispose()` closes the runtime, stops the actor and releases its resources. Call it when your application shuts down.

If the machine requires services, provide their Layers to the actor Layer with `Layer.provide`.

## Clock

`after` transitions and delayed sends use Effect's `Clock`. In tests, `TestClock` advances those timers without waiting for real time. See the [complete deadline example](testing-and-errors.md#testclock).

Timers are interrupted when the actor stops.

## Persisting and restoring

An actor can outlive its process. Save `actor.getPersistedSnapshot()` after an event, then pass the saved snapshot to `createEffectActor` when the next event arrives, in the same process or another one.

<!-- example from examples/effect-workflows/src/persistence.ts -->

```ts
import { Effect } from 'effect';
import { createEffectActor, waitFor } from '@xstate/effect';
import { createMachine, type Snapshot } from 'xstate';

const review = createMachine({
  id: 'review',
  initial: 'draft',
  states: {
    draft: { on: { SUBMIT: { target: 'inReview' } } },
    inReview: { on: { APPROVE: { target: 'approved' } } },
    approved: { type: 'final' }
  }
});

// Handle one event, then return the snapshot to store.
const handle = (
  stored: Snapshot<unknown> | undefined,
  event: { type: 'SUBMIT' } | { type: 'APPROVE' }
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const actor = yield* createEffectActor(review, { snapshot: stored });
      const before = actor.getSnapshot();
      actor.send(event);
      yield* waitFor(actor, (snapshot) => snapshot !== before);
      return JSON.parse(JSON.stringify(actor.getPersistedSnapshot()));
    })
  );

const program = Effect.gen(function* () {
  const submitted = yield* handle(undefined, { type: 'SUBMIT' });
  // Store `submitted` in a database row or a Durable Object, possibly for days.
  const approved = yield* handle(submitted, { type: 'APPROVE' });
  return approved.status;
});

export const result = await Effect.runPromise(program);
console.log(result); // 'done'
```

Restoring resumes the persisted state and context without running entry actions again.

- A pending `after` transition or delayed send keeps its original deadline, measured on Effect's `Clock`. A deadline that passed while the snapshot was stored fires as soon as the actor starts.
- State-machine children resume their persisted state and context.
- Completed children do not restart.
- Running Effect tasks and streams restart from the beginning: a `fromEffect` task runs its Effect again, and a `fromEffectStream` or `fromEffectEventStream` stream starts again from its first item. A half-finished Effect cannot be persisted, so this matches how XState restarts running async and callback actors. Make that work safe to repeat, for example with an idempotency key.
- A snapshot-only restore does not need `input`, even when the logic requires it.
- The restored actor belongs to the enclosing scope like any other: closing the scope stops it, its children and its timers.

## Actor handle

The `EffectActor` handle supports:

- `send`, `getSnapshot`, `subscribe` and `on` from XState's actor reference contract;
- `inspect`, `getPersistedSnapshot` and `stop`;
- this package's [actor functions](observing-actors.md) and `useSelector` from `@xstate/react`.

## Requirements

`RequirementsFrom<TLogic>` collects the services needed by:

- actions registered with `setupEffect({ actions })`;
- actors registered with `setup({ actors })` or `setupEffect({ actors })`;
- inline `invoke.src` logic, at the root or in a state;
- those same sources inside child machines, up to 10 levels of nesting.

`createEffectActor` returns `Effect<EffectActor<TLogic>, never, R | Scope>`, where `R` is that service union. TypeScript checks that you provide those services before running the program. Overrides passed to `machine.provide` contribute their current services, replacing the requirements of the sources they override. Actor and invocation scopes are supplied automatically.

Declare spawned Effect logic in `actors` and spawn it by name. See [declared sources](schemas-and-actions.md#declared-sources).

<details>
<summary>Requirement inference limits and creation errors</summary>

- Requirements deeper than 10 machine levels are not collected. Flatten that tree, or provide the deeper services explicitly.
- Inline logic passed to `enq.spawn` is invisible to requirement inference and is rejected at runtime.
- The `never` error channel means actor creation has no typed failures. It does not describe the actor's later result; use `join` to observe that result.
- Missing services and other programming errors can put the actor in the `error` status. Invalid input rejected by a runtime validator makes creation fail as a defect.

</details>
