---
title: Schemas and actions
description: Declare Effect schemas and Effect actions with setupEffect.
---

`setupEffect` is the Effect-aware form of XState's [`setup`](../setup-and-provide.md). It accepts Effect `Schema` values wherever `setup` accepts Standard Schemas, and actions that return an Effect. Everything else, including `actors`, `guards`, `delays` and `extend`, behaves as in `setup`. Machines built from it must be started with `createEffectActor`.

## Effect schemas

`setupEffect` accepts Effect schemas in `schemas`, in `states`, and in `setupEffect(...).extend(...)`. XState infers the decoded `Schema.Type`, so there is no call to `Schema.toStandardSchemaV1`.

```ts
import { Schema } from 'effect';
import { setupEffect } from '@xstate/effect';

const machine = setupEffect({
  schemas: {
    context: Schema.Struct({ count: Schema.Number }),
    events: {
      ADD: Schema.Struct({ value: Schema.Number })
    }
  }
}).createMachine({
  context: { count: 0 },
  on: {
    ADD: ({ context, event }) => ({
      context: { count: context.count + event.value }
    })
  }
});
```

The `states` option declares per-state schemas, so each state can narrow the context. [`taggedState`](matching-states.md) narrows `context` along with `_tag`.

```ts
const checkout = setupEffect({
  schemas: { context: Schema.Struct({ total: Schema.Number }) },
  states: {
    paying: {
      schemas: { context: Schema.Struct({ paymentId: Schema.String }) }
    }
  }
});
```

Standard Schemas remain supported and can be mixed with Effect schemas in one machine. `EffectSchemaLike` is the type of either.

### The validation seam

Schemas provide types without a `validator`. Adding `standardSchemaValidator()` from `xstate/validation` turns them into runtime assertions.

XState validation checks a value but does not replace it with a transformed value. When runtime validation is enabled, TypeScript rejects schemas whose encoded and decoded types differ, such as `Schema.NumberFromString`. Effect schemas used at this seam must decode synchronously and without service requirements.

## Effect actions

`setupEffect({ actions })` declares actions that return an Effect. An Effect action is fire-and-forget: the transition enqueues it, the transition commits, and the Effect then runs in the actor's Effect context without blocking the actor. The actor processes the next event while the Effect runs.

In XState v6 an action is a plain function that a transition enqueues with explicit arguments, `enq(args.actions.audit, args)`. `setupEffect` keeps that contract. The function is called synchronously during the transition, and the Effect it returns is the asynchronous boundary. `EffectActionArgs` is the argument type, and `EffectAction` is the action type.

```ts
import { Context, Effect } from 'effect';
import { setupEffect } from '@xstate/effect';

class Audit extends Context.Service<
  Audit,
  { readonly record: (count: number) => Effect.Effect<void> }
>()('@app/Audit') {}

const machine = setupEffect({
  actions: {
    audit: ({ context }) => Audit.use((audit) => audit.record(context.count))
  }
}).createMachine({
  context: { count: 1 },
  initial: 'active',
  states: {
    active: {
      on: {
        AUDIT: (args, enq) => enq(args.actions.audit, args)
      }
    }
  }
});
```

Failures and defects of the Effect route to the state's `onError`. The Effect is interrupted when the actor stops, and interruption is not an error.

Use Effect actions for work whose result the machine does not need: logging, telemetry, notifications, cache writes. When the result matters, invoke the Effect as an actor with [`fromEffect`](effect-logic.md), so `onDone` and `onError` receive it typed and the state models the wait.

An Effect action cannot enqueue, because it runs after the transition. Enqueue from the transition function, which has the machine's event types. To hand a result back to the machine, send an event to `self`:

```ts
const machine = setupEffect({
  schemas: {
    events: {
      SAVE: Schema.Struct({}),
      SYNCED: Schema.Struct({ version: Schema.Number })
    }
  },
  actions: {
    sync: ({ context, self }) =>
      Effect.gen(function* () {
        const version = yield* Api.use((api) => api.sync(context.draft));
        yield* Effect.sync(() => self.send({ type: 'SYNCED', version }));
      })
  }
}).createMachine({
  context: { draft: '', version: 0 },
  initial: 'active',
  states: {
    active: {
      on: {
        SAVE: (args, enq) => enq(args.actions.sync, args),
        SYNCED: ({ context, event }) => ({
          context: { ...context, version: event.version }
        })
      }
    }
  }
});
```

`machine.provide({ actions })` overrides a declared action with another Effect-returning action, hosted the same way.

## Declared only

Anything that touches the Effect context must be a declared action or a declared actor. Only declared sources contribute to the actor's [requirements](actors.md#requirements), so an inline Effect infers `R = never` and fails at runtime when a service is missing. Declared actions also carry a name for inspection and for `machine.provide` overrides.

- Register Effect actions with `setupEffect({ actions })` and run them with `enq(args.actions.name, args)`.
- Register spawned Effect logic with `setup({ actors })` or `setupEffect({ actors })` and spawn it with `enq.spawn(args.actors.name)`. Spawning inline Effect logic throws at runtime.
- Effect logic used inline as `invoke.src` runs and contributes to `RequirementsFrom`. Registering it in `actors` gives it a name.

An inline action that returns an Effect does not run it. `enq(() => Effect.log('saved'))` creates the Effect and discards it, because XState only awaits returned promises.

This repository ships an oxlint rule, `xstate-effect/no-inline-effect` in `scripts/oxlint-plugin-xstate-effect.mjs`, that reports both mistakes: an Effect returned from an inline enqueue callback, and inline Effect logic passed to `enq.spawn`. The rule recognizes an Effect by the root identifier `Effect`, so an Effect produced by a helper function is not reported.
