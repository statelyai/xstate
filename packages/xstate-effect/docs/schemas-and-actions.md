---
title: "XState Effect: Schemas and actions"
description: Type workflow data and run background work with setupEffect.
---

`setupEffect` is the Effect-aware form of XState's [`setup`](../../../docs/setup-and-provide.md).

- Declare input, context, events and output with Effect schemas.
- Register actions that return Effects.
- Register actors, guards and delays as you would with `setup`.
- Start the machine with `createEffectActor`.

## Decoding external data

Decode unknown input and events before actor creation or sending. `Schema.decodeUnknownEffect` retains async decoding and service requirements. When runtime validation is enabled, declare the decoded Type schema with `Schema.toType`; transitions validate decoded values synchronously.

<!-- example from examples/effect-workflows/src/boundaries.ts -->

```ts
import { Effect, Schema } from 'effect';
import { createEffectActor, setupEffect } from '@xstate/effect';
import { sendAndAwait } from '@xstate/effect/test';
import { standardSchemaValidator } from 'xstate/validation';

const Input = Schema.Struct({ count: Schema.NumberFromString });
const Add = Schema.Struct({
  type: Schema.Literal('ADD'),
  delta: Schema.NumberFromString
});
const counter = setupEffect({
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

const program = Effect.gen(function* () {
  const input = yield* Schema.decodeUnknownEffect(Input)({ count: '2' });
  const actor = yield* createEffectActor(counter, { input });
  const event = yield* Schema.decodeUnknownEffect(Add)({
    type: 'ADD',
    delta: '3'
  });
  return (yield* sendAndAwait(actor, event)).context.count;
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result); // 5
```

Transforming schemas remain unsupported directly in synchronous runtime validation. Decode once at the boundary instead of repeating the transformation inside a transition.

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
- `createEffectLogic` also accepts Effect input and output schemas.

### Action argument types

<!-- action argument inference from src/setupEffect.ts -->

Declared actions infer `context` from the setup's decoded context schema. Their `event` is the union of `schemas.events` and `schemas.internalEvents`. Check `event.type` before reading a payload that belongs to one event. Omitting `schemas.events` allows unknown public events, so internal event payloads cannot narrow by type alone. Use `events: {}` when there are no public events to keep internal events discriminable.

An extension's actions use the merged schemas. Context schemas replace the previous context type. Event and action schema entries merge by name, with extension entries replacing matching names.

Without a context schema, action context values are `unknown`. Without event schemas, actions receive `{ type: string }`. A later `createMachine` configuration cannot infer types for earlier action callbacks. Declare setup schemas or annotate the callback argument.

To give an action a different argument, declare `schemas.actions.<name>.params`. This schema describes the entire first argument. Include `self` when enqueueing the action so its Effect runs in the owning actor's context:

<!-- example from examples/effect-workflows/src/custom-actions.ts -->

```ts
import { createInspector } from '@statelyai/sdk';
import { Effect, Latch, Schema } from 'effect';
import type { Snapshot } from 'xstate';
import { createEffectActor, send, setupEffect } from '@xstate/effect';

const messages: string[] = [];
const recorded = Latch.makeUnsafe();
const machine = setupEffect({
  schemas: {
    actions: {
      audit: { params: Schema.Struct({ message: Schema.String }) }
    }
  },
  actions: {
    audit: ({ message }) =>
      Effect.sync(() => {
        messages.push(message);
      }).pipe(Effect.andThen(recorded.open))
  }
}).createMachine({
  on: {
    SAVE: (args, enq) =>
      enq(args.actions.audit, { self: args.self, message: 'saved' })
  }
});

const inspectorSnapshot = (snapshot: Snapshot<unknown>) => ({
  status: snapshot.status,
  ...('value' in snapshot ? { value: snapshot.value } : {})
});

const program = Effect.gen(function* () {
  const inspector = yield* Effect.acquireRelease(
    Effect.sync(() =>
      process.env.INSPECT === '1' ? createInspector() : undefined
    ),
    (inspector) => Effect.sync(() => inspector?.destroy())
  );
  const actor = yield* createEffectActor(machine);
  if (inspector) {
    inspector.actor(actor.sessionId!, {
      machine: machine.config,
      snapshot: inspectorSnapshot(actor.getSnapshot())
    });
    yield* Effect.acquireRelease(
      Effect.sync(() =>
        actor.inspect((event) => {
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
    yield* Effect.promise(() => inspector.ready);
  }
  yield* send(actor, { type: 'SAVE' });
  yield* recorded.await;
  return messages;
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result);
```

The same `params` schema defines arguments for an action replacement passed to `machine.provide`. Actions without an argument schema retain their explicitly annotated callback arguments. When a source map mixes custom annotated arguments with inferred arguments, declare the custom arguments in `schemas.actions.<name>.params` so every callback receives a contextual type.

### Runtime validation

Add `standardSchemaValidator()` from `xstate/validation` to check values at runtime, as above. Without a validator, schemas provide types only.

<details>
<summary>Runtime schema constraints</summary>

XState checks values but does not replace them with decoded values. With runtime validation enabled, encoded and decoded types must match; transforming schemas such as `Schema.NumberFromString` are rejected by TypeScript. Schemas must decode synchronously, without service requirements.

</details>

## Choose an action or an actor

- Use an **Effect action** for background work: audit entries, logging, telemetry or notifications. The transition commits without waiting for it.
- Use an **invoked Effect actor** when success or failure decides the next state. `createEffectLogic` gives `onDone` and `onError` typed results and interrupts the task when its invoking state exits.

An Effect action runs in the actor's Effect context. Its failures and defects route to the current state's `onError`; stopping the actor interrupts it without reporting an error.

<details>
<summary>Action execution and completion</summary>

The action function is called synchronously during the transition. The returned Effect runs after the transition commits, in a forked fiber, without blocking subsequent events.

- The transition enqueues the action with explicit arguments: `enq(args.actions.audit, args)`.
- `EffectActionArgs` and `EffectAction` name the argument and action types.
- An Effect action cannot use the transition's enqueue API after the transition. It can call `self.send` to send a new event.
- A final state or a closing scope can interrupt pending background work. Invoke a task when the workflow must wait for completion.

</details>

## Provide an action

Use `machine.provide({ actions })` to replace an action for a particular environment. The provided machine requires the replacement's services. In this example, an audit implementation adds the `Audit` service:

<!-- example from examples/effect-workflows/src/provided-actions.ts -->

```ts
import { Context, Effect, Latch } from 'effect';
import { createEffectActor, send, setupEffect } from '@xstate/effect';

class Audit extends Context.Service<Audit, { record: Effect.Effect<void> }>()(
  'Audit'
) {}

const recorded = Latch.makeUnsafe();
const machine = setupEffect({
  actions: { audit: (_args) => Effect.void }
}).createMachine({
  on: { APPROVE: (args, enq) => enq(args.actions.audit, args) }
});

const auditedMachine = machine.provide({
  actions: { audit: () => Audit.use((audit) => audit.record) }
});

const program = Effect.gen(function* () {
  // The override adds Audit to this machine's required services.
  const actor = yield* createEffectActor(auditedMachine);
  yield* send(actor, { type: 'APPROVE' });
  yield* recorded.await;
  return 'approval recorded';
});

export const result = await Effect.runPromise(
  program.pipe(
    Effect.scoped,
    Effect.provideService(Audit, { record: Effect.asVoid(recorded.open) })
  )
);
console.log(result); // approval recorded
```

- Other actions and their service requirements stay in place.
- Replacing the audit with an action that requires a different service updates the required service type again.
- A plain action can replace an Effect action and remove its service requirement.

## Declared sources

Declare Effect actions and spawned Effect actors so their services contribute to [requirement inference](actors.md#requirements).

- Register actions with `setupEffect({ actions })`, then enqueue the named action.
- Register spawned logic in `actors`, then use `enq.spawn(args.actors.worker)`.
- Inline `invoke.src` logic is supported and contributes requirements; declaring it in `actors` also gives it a reusable name.

<details>
<summary>Inline action and spawn pitfalls</summary>

An inline callback such as `enq(() => Effect.log('saved'))` creates an Effect that is discarded. Inline Effect logic passed to `enq.spawn` is rejected at runtime because its service requirements cannot be inferred.

The `xstate-effect/no-inline-effect` oxlint rule checks these two patterns. It recognizes the root identifier `Effect`; Effects returned by helper functions are outside that check.

The rule is not published as a package. To use it, install `@oxlint/plugins`, copy [`oxlint-plugin-xstate-effect.ts`](https://github.com/statelyai/xstate/blob/next/scripts/oxlint-plugin-xstate-effect.ts) from the XState repository and configure it in `jsPlugins`. Loading the TypeScript source requires Node.js 22.18+ or a newer release with native TypeScript support.

</details>
