---
title: "XState Effect: Actors"
description: Create actors whose lifetime and dependencies belong to an Effect application.
---

`createEffectActor(logic, options?)` starts an actor and returns its handle as a scoped Effect.

- Pass `options.input` when the logic requires input.
- Provide the services required by its declared actions and child actors.
- Use `Effect.scoped` for a bounded program, or a Layer for an application service.

The [quick start](quick-start.md) shows an actor with input and a deployment service.

## Lifetime

The enclosing scope owns the actor. When that scope closes, the actor stops and its hosted Effects are interrupted.

- `Effect.scoped(program)` closes the scope when `program` finishes.
- `actor.stop()` stops the actor explicitly.
- `Effect.addFinalizer` and `Effect.acquireRelease` in hosted Effects register cleanup with the actor's scope. That cleanup runs when the actor stops.
- The enclosing scope waits for the actor's finalizers before finishing its own cleanup.

Provide application Layers outside `Effect.scoped`, with `program.pipe(Effect.scoped, Effect.provide(AppLayer))`, so services remain available while actor cleanup runs.

<details>
<summary>Invocation lifetime and resource lifetime</summary>

Leaving an invoking state interrupts its child's running Effect. Finalizers registered with the actor-hosted `Scope` live until the owning Effect actor stops. Use an inner `Effect.scoped` when a resource should be released as soon as that individual operation finishes or is interrupted.

</details>

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

`createEffectActor` returns `Effect<EffectActor<TLogic>, never, R | Scope>`, where `R` is that service union. TypeScript checks that you provide those services before running the program.

Declare spawned Effect logic in `actors` and spawn it by name. See [declared sources](schemas-and-actions.md#declared-sources).

<details>
<summary>Requirement inference limits and creation errors</summary>

- Requirements deeper than 10 machine levels are not collected. Flatten that tree, or provide the deeper services explicitly.
- Inline logic passed to `enq.spawn` is invisible to requirement inference and is rejected at runtime.
- The `never` error channel means actor creation has no typed failures. It does not describe the actor's later result; use `join` to observe that result.
- Missing services and other programming errors can put the actor in the `error` status. Invalid input rejected by a runtime validator makes creation fail as a defect.

</details>
