# @xstate/effect

Effect integration for XState v6.

This package is experimental and targets XState v6 alpha and Effect 4 RC.

## Installation

<!-- package name and peer dependencies from package.json -->

```bash
npm install @xstate/effect@alpha xstate@alpha effect@rc
```

## Quick start

<!-- public API from src/index.ts; actor lifetime from src/createEffectActor.ts -->

`createEffectActor` creates and starts an XState actor inside an Effect. The actor is a scoped resource: it stops when the enclosing `Scope` closes. `fromEffect` turns an Effect into actor logic that a machine can invoke. The machine itself is an ordinary v6 machine.

```ts
import { Context, Effect, Schema } from 'effect';
import { createEffectActor, fromEffect, waitFor } from '@xstate/effect';
import { setup } from 'xstate';

interface ApiService {
  fetchUser: (id: string) => Effect.Effect<{ id: string }, Error>;
}

const Api = Context.Service<ApiService>('Api');

const fetchUser = fromEffect({
  schemas: {
    input: Schema.Struct({ id: Schema.String }),
    output: Schema.Struct({ id: Schema.String })
  },
  effect: ({ input }) => Api.use((api) => api.fetchUser(input.id))
});

const machine = setup({ actors: { fetchUser } }).createMachine({
  initial: 'loading',
  states: {
    loading: {
      invoke: {
        src: 'fetchUser',
        input: { id: '42' },
        onDone: { target: 'success' },
        onError: { target: 'failure' }
      }
    },
    success: {},
    failure: {}
  }
});

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(machine);
  const snapshot = yield* waitFor(actor, (s) => s.matches('success'));
  return snapshot.value;
});

await Effect.runPromise(
  Effect.provideService(Effect.scoped(program), Api, {
    fetchUser: (id) => Effect.succeed({ id })
  })
);
```

Effect-backed logic must run under `createEffectActor`. Starting it with `createActor` puts the actor in the `error` status because no Effect runtime is available.

## Actors

### Lifetime

`createEffectActor(logic, options?)` returns `Effect<Actor, never, R | Scope>`, where `R` is the union of service requirements of the logic (see [Requirements](#requirements)). The actor stops, and every Effect it hosts is interrupted, when the scope closes. Use `Effect.scoped` to close the scope when the program finishes, or run the actor inside a Layer to tie it to the application's lifetime.

Effects hosted by the actor see a `Scope` that closes when the actor stops. `Effect.addFinalizer` and `Effect.acquireRelease` inside an actor's Effects release with the actor, not with the Effect that registered them.

Provide Layers outside `Effect.scoped`, so their resources are released after the actor has stopped:

```ts
await Effect.runPromise(
  program.pipe(Effect.scoped, Effect.provide(AppLayer))
);
```

`actor.stop()` still works. It stops the actor and closes the actor's scope; the enclosing scope closes normally afterwards.

### Clock

XState timers (`after` transitions and delayed events) use the Effect `Clock` service by default. In production this is the live clock. In tests, `TestClock` from `effect/testing` drives them:

```ts
import { TestClock } from 'effect/testing';

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(machine);
  yield* TestClock.adjust('5 seconds');
  return actor.getSnapshot().value;
});

await Effect.runPromise(
  program.pipe(Effect.scoped, Effect.provide(TestClock.layer()))
);
```

Pass `options.clock` to use a different clock, such as XState's `SimulatedClock`.

### Requirements

`RequirementsFrom<Logic>` is the `R` channel of `createEffectActor`. It collects the requirements of:

- actions registered with `setupEffect({ actions })`,
- actors registered with `setup({ actors })` or `setupEffect({ actors })`,
- logic used inline as `invoke.src`, at the root or in any state,
- all of the above inside child machines, whether registered or invoked inline, up to 10 levels of nesting.

Two sources are not visible to the type because they live inside transition function bodies: logic passed to `enq.spawn` and Effects run with `runEffect`. They still run in the captured context, and a missing service fails at runtime.

> **Warning:** Spawn registered actors (`enq.spawn(args.actors.worker)`) and register actions with `setupEffect` to keep requirements typed. Inline `enq.spawn(logic)` and `runEffect` typecheck with `R = never` and fail at runtime when a service is missing.

### Observing actors

<!-- actor surface from src/actor.ts -->

These functions expose an actor through Effects and Streams. The plain XState `Actor` remains the handle, so `@xstate/react` and other bindings keep working.

| Function                                   | Returns                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `send(actor, event)`                       | `Effect<void>`                                                         |
| `snapshots(actor)`                         | `Stream<Snapshot>`: the current snapshot, then each change             |
| `emitted(actor)`                           | `Stream<Emitted>`: events emitted with `emit`                          |
| `waitFor(actor, predicate, { timeout? })`  | `Effect<Snapshot, ActorStoppedError \| TimeoutError>`                  |
| `toEffect(actor)`                          | `Effect<Output, ErrorFrom<Logic> \| ActorStoppedError>`                |
| `inspect(actor)`                           | `Stream<InspectionEvent>`                                              |

`snapshots` ends when the actor completes. If the actor errors, the stream emits the error snapshot and ends. `waitFor` and `toEffect` fail with `ActorStoppedError` when the actor stops or errors before the awaited result; `toEffect` fails with the actor's typed error when the actor's status is `error`.

```ts
const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(fetchUser, { input: { id: '42' } });
  const user = yield* toEffect(actor);
  return user.id;
});
```

## Effect actor logic

<!-- fromEffect, fromEffectStream, fromEffectEventStream from src/fromEffect.ts -->

### `fromEffect`

`fromEffect` accepts an Effect, a function that returns an Effect, or a config object:

```ts
fromEffect(Effect.succeed('done'));

fromEffect(({ input }: { input: string }) => Effect.succeed(input.length));

fromEffect({
  id: 'loadUser',
  schemas: {
    input: Schema.Struct({ id: Schema.String }),
    output: Schema.Struct({ id: Schema.String })
  },
  effect: ({ input }) => Api.use((api) => api.fetchUser(input.id))
});
```

The function form receives `{ input, self, system, emit }`. `emit` publishes an event that `actor.on(...)` and `emitted(actor)` observe. Either schema may be omitted; the missing type is inferred from the Effect.

The actor's result maps from the Effect's exit:

- Success: status `done` with the value as `output`.
- Failure: status `error` with the `E` value as `error`. `invoke.onError` receives it typed through `ErrorFrom`.
- Defect: status `error` with the squashed cause. Defects are not part of the typed error.
- Interruption caused by the actor stopping or by the invoking state exiting: no error. The actor is stopped.
- Interruption from inside the Effect, such as `Effect.interrupt`: status `error` with an `EffectInterruptedError`. An `Effect.timeout` is a failure with `TimeoutError`, not an interruption; a lost `Effect.race` inside the Effect interrupts only the loser and the actor completes with the winner.

Use `Effect.timeout`, `Effect.retry` and the other Effect combinators inside the Effect. `fromEffect` does not add its own options for them.

### `fromEffectStream`

`fromEffectStream` exposes the latest stream item as the actor's `context` and reaches `done` when the stream completes. A stream failure puts the actor in the `error` status.

```ts
fromEffectStream(Stream.make(1, 2, 3));

fromEffectStream({
  schemas: { input: Schema.Struct({ topic: Schema.String }) },
  stream: ({ input }) => Stream.fromPubSub(topics.get(input.topic))
});
```

### `fromEffectEventStream`

`fromEffectEventStream` relays each stream item to the parent machine as an event. It accepts the same forms as `fromEffectStream`.

```ts
const machine = createMachine({
  context: { seen: 0 },
  schemas: { events: { VALUE: types<{ value: number }>() } },
  initial: 'active',
  states: {
    active: {
      invoke: {
        src: fromEffectEventStream(
          Stream.make({ type: 'VALUE', value: 1 }, { type: 'VALUE', value: 2 })
        )
      },
      on: {
        VALUE: ({ context, event }) => ({
          context: { seen: context.seen + event.value }
        })
      }
    }
  }
});
```

Effect-backed logic can be persisted and restored with the normal XState APIs. Restoring an active snapshot runs the Effect or stream again.

## Effect schemas

<!-- schema conversion from src/schema.ts -->

`setupEffect` accepts Effect schemas in its `schemas` and `states` options, and in `setupEffect(...).extend(...)`. XState infers the decoded `Schema.Type`; there is no need to call `Schema.toStandardSchemaV1`.

```ts
import { Effect, Schema } from 'effect';
import { createEffectActor, setupEffect } from '@xstate/effect';

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

Standard Schemas remain supported and can be mixed with Effect schemas. Schemas provide types without a `validator`; adding `standardSchemaValidator()` from `xstate/validation` enables runtime assertions.

XState validation checks a value but does not replace it with a transformed value. When runtime validation is enabled, TypeScript rejects schemas whose encoded and decoded types differ, such as `Schema.NumberFromString`. Effect schemas used at this validation seam must decode synchronously and without service requirements.

## Effect actions

<!-- effect action contract from src/setupEffect.ts; runEffect from src/runEffect.ts -->

`setupEffect({ actions })` registers actions that return Effects. They run in the actor's context and are interrupted when the actor stops. Failures and defects route to the state's `onError`. The v6 enqueue contract is preserved, so action parameters are passed explicitly:

```ts
const machine = setupEffect({
  actions: {
    audit: ({ context }) =>
      Effect.sync(() => console.log('count', context.count))
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

For an action that needs XState enqueue methods, pass the enqueue object as a second action parameter and keep enqueue operations outside the Effect. The enqueue calls are planned synchronously by the action function; the returned Effect is the asynchronous boundary.

```ts
const machine = setupEffect({
  actions: {
    audit: ({ context }, enq) => {
      enq?.raise({ type: 'AUDIT_COMPLETE', count: context.count });
      return Effect.sync(() => console.log('count', context.count));
    }
  }
}).createMachine({
  context: { count: 1 },
  initial: 'active',
  states: {
    active: {
      on: {
        AUDIT: (args, enq) => enq(args.actions.audit, args, enq)
      }
    }
  }
});
```

`runEffect(self, effect)` runs an Effect from an inline action. It has the same lifetime and error behavior as a registered Effect action, but its requirements are not reflected in `RequirementsFrom`.

```ts
const machine = createMachine({
  on: {
    SAVE: (args, enq) => enq(runEffect, args.self, Effect.log('saving'))
  }
});
```

Effect actions and `runEffect` do not block the actor. The actor processes the next event while the Effect runs.

## Tracing

Every Effect the actor hosts runs inside a span named `xstate.effect` with the attributes `xstate.actor.id` and `xstate.actor.address`. Provide an Effect `Tracer` to export them.
