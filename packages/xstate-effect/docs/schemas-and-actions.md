---
title: "XState Effect: Schemas and actions"
description: Type workflow data and run background work with setupEffect.
---

`setupEffect` is the Effect-aware form of XState's [`setup`](../setup-and-provide.md).

- Declare input, context, events and output with Effect schemas.
- Register actions that return Effects.
- Register actors, guards and delays as you would with `setup`.
- Start the machine with `createEffectActor`.

## Schemas and background actions

This machine accepts a typed approval event and records an audit entry without blocking its transition:

<!-- example from examples/effect-workflows/src/actions.ts -->

```ts
import { Context, Effect, Latch, Schema } from 'effect';
import { createEffectActor, send, setupEffect, waitFor } from '@xstate/effect';
import { standardSchemaValidator } from 'xstate/validation';

class Audit extends Context.Service<
  Audit,
  { readonly record: (reviewer: string) => Effect.Effect<void> }
>()('@app/Audit') {}

const reviewMachine = setupEffect({
  schemas: { events: { APPROVE: Schema.Struct({ reviewer: Schema.String }) } },
  actions: {
    audit: ({ event }) => Audit.use((audit) => audit.record(event.reviewer))
  }
}).createMachine({
  validator: standardSchemaValidator(),
  initial: 'pending',
  states: {
    pending: {
      on: {
        APPROVE: (args, enq) => {
          enq(args.actions.audit, args);
          return { target: 'approved' };
        }
      }
    },
    // Keep the actor alive while its background audit runs.
    approved: {}
  }
});

const program = Effect.gen(function* () {
  const recorded = yield* Latch.make();
  const actor = yield* createEffectActor(reviewMachine).pipe(
    Effect.provideService(Audit, { record: () => Effect.asVoid(recorded.open) })
  );
  yield* send(actor, { type: 'APPROVE', reviewer: 'Ada' });
  yield* waitFor(actor, (s) => s.matches('approved'));
  // Wait for the demo audit before closing the scope.
  yield* recorded.await;
  return actor.getSnapshot().value;
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result); // 'approved'
```

The latch lets this demo wait for the audit before closing its scope. In an application, keep the actor alive for the workflow's lifetime.

### Effect schemas

`setupEffect` accepts Effect schemas in `schemas`, per-state `states` declarations and `extend`.

- Types come from the decoded `Schema.Type`; no manual conversion is needed.
- Per-state schemas narrow context with [`taggedState`](matching-states.md).
- Standard Schemas can be mixed with Effect schemas. `EffectSchemaLike` represents either kind.
- `fromEffect` also accepts Effect input and output schemas.

### Runtime validation

Add `standardSchemaValidator()` from `xstate/validation` to check values at runtime, as above. Without a validator, schemas provide types only.

<details>
<summary>Runtime schema constraints</summary>

XState checks values but does not replace them with decoded values. With runtime validation enabled, encoded and decoded types must match; transforming schemas such as `Schema.NumberFromString` are rejected by TypeScript. Schemas must decode synchronously, without service requirements.

</details>

## Choose an action or an actor

- Use an **Effect action** for background work: audit entries, logging, telemetry or notifications. The transition commits without waiting for it.
- Use an **invoked Effect actor** when success or failure decides the next state. `fromEffect` gives `onDone` and `onError` typed results and interrupts the task when its invoking state exits.

An Effect action runs in the actor's Effect context. Its failures and defects route to the current state's `onError`; stopping the actor interrupts it without reporting an error.

<details>
<summary>Action execution and completion</summary>

The action function is called synchronously during the transition. The returned Effect runs after the transition commits, in a forked fiber, without blocking subsequent events.

- The transition enqueues the action with explicit arguments: `enq(args.actions.audit, args)`.
- `EffectActionArgs` and `EffectAction` name the argument and action types.
- An Effect action cannot use the transition's enqueue API after the transition. It can call `self.send` to send a new event.
- `machine.provide({ actions })` can replace a declared action with another Effect-returning action.
- A final state or a closing scope can interrupt pending background work. Invoke a task when the workflow must wait for completion.

</details>

## Declared sources

Declare Effect actions and spawned Effect actors so their services contribute to [requirement inference](actors.md#requirements).

- Register actions with `setupEffect({ actions })`, then enqueue the named action.
- Register spawned logic in `actors`, then use `enq.spawn(args.actors.worker)`.
- Inline `invoke.src` logic is supported and contributes requirements; declaring it in `actors` also gives it a reusable name.

<details>
<summary>Inline action and spawn pitfalls</summary>

An inline callback such as `enq(() => Effect.log('saved'))` creates an Effect that is discarded. Inline Effect logic passed to `enq.spawn` is rejected at runtime because its service requirements cannot be inferred.

The repository's `xstate-effect/no-inline-effect` oxlint rule checks these two patterns. It recognizes the root identifier `Effect`; Effects returned by helper functions are outside that check.

To use the plugin elsewhere, install `@oxlint/plugins`, copy `scripts/oxlint-plugin-xstate-effect.ts` and configure it in `jsPlugins`. Loading the TypeScript source requires Node.js 22.18+ or a newer release with native TypeScript support.

</details>
