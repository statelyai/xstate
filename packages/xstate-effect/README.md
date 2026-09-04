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

class Api extends Context.Service<
  Api,
  {
    readonly fetchUser: (id: string) => Effect.Effect<{ id: string }, Error>;
  }
>()('@app/Api') {}

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
await Effect.runPromise(program.pipe(Effect.scoped, Effect.provide(AppLayer)));
```

`actor.stop()` still works. It stops the actor and closes the actor's scope synchronously; the release step of `createEffectActor` waits for the actor scope's finalizers before the enclosing scope continues closing.

### Providing an actor as a service

An actor built by `createEffectActor` is a scoped Effect, so `Layer.effect` turns it into a service. The actor starts when the Layer is built and stops when the Layer's scope closes.

```ts
import { Context, Effect, Layer, ManagedRuntime } from 'effect';
import { createEffectActor, send, waitFor } from '@xstate/effect';
import type { Actor } from 'xstate';

class CheckoutActor extends Context.Service<
  CheckoutActor,
  Actor<typeof checkoutMachine>
>()('@app/CheckoutActor') {}

const CheckoutActorLayer = Layer.effect(
  CheckoutActor,
  createEffectActor(checkoutMachine)
);
```

The Layer's requirements are the machine's requirements, so the services the machine needs are provided the same way as for any other Layer:

```ts
const AppLayer = CheckoutActorLayer.pipe(Layer.provide(PaymentsLayer));
```

At an edge that is not itself an Effect, build the Layer once with a `ManagedRuntime` and run individual Effects against it:

```ts
const runtime = ManagedRuntime.make(AppLayer);

const pay = runtime.runPromise(
  Effect.gen(function* () {
    const actor = yield* CheckoutActor;
    yield* send(actor, { type: 'PAY' });
    return yield* waitFor(actor, (s) => s.matches('paid'));
  })
);

// When the process shuts down:
await runtime.dispose();
```

`runtime.dispose()` closes the runtime's scope, which stops the actor and releases the Layers it was built from.

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
- all of the above inside child machines, whether registered or invoked inline, up to 10 levels of machine nesting.

Past 10 levels the type stops recursing and contributes `never`, so requirements introduced deeper than that are not part of `R`. TypeScript then accepts a program that does not provide the service, and the actor fails at runtime when the missing service is requested. Flatten the machine tree, or provide those services explicitly, if a machine nests that deeply.

`never` in the `R` channel means "no requirement collected", not "no failure possible". `createEffectActor` is typed `Effect<Actor, never, R | Scope>` and has no typed failures at all. Starting Effect-backed logic outside `createEffectActor`, spawning undeclared Effect logic, and using a service that was not collected are programming errors: they surface as the actor's `error` status, not as an Effect failure. Input rejected by a runtime `validator` is thrown while the actor is created, so `createEffectActor` dies with that error as a defect.

Logic passed inline to `enq.spawn` lives inside a transition function body and is not visible to the type. Spawning inline Effect logic is therefore rejected at runtime; spawn a declared actor instead (`enq.spawn(args.actors.worker)`). See [Declared only](#declared-only).

### Observing actors

<!-- actor surface from src/actor.ts -->

These are free functions that take a plain XState `Actor` or `ActorRef`. `createEffectActor` returns that actor, not a wrapper handle with Effect methods on it. So they apply to any actor reference, including children read from `snapshot.children` and actors created outside this package; a bundler drops the ones a program does not import; and everything that already accepts an XState actor, such as `useSelector` and the inspection APIs, works on the same object.

| Function                                 | Returns                                                     |
| ---------------------------------------- | ----------------------------------------------------------- |
| `send(actor, event)`                     | `Effect<void>`                                              |
| `snapshots(actor)`                       | `Stream<Snapshot>`: the current snapshot, then each change  |
| `emitted(actor)`                         | `Stream<Emitted>`: events emitted with `emit`               |
| `waitFor(actor, predicate)`              | `Effect<Snapshot, ActorStoppedError>`                       |
| `waitFor(actor, predicate, { timeout })` | `Effect<Snapshot, ActorStoppedError \| Cause.TimeoutError>` |
| `join(actor)`                            | `Effect<Output, ErrorFrom<Logic> \| ActorStoppedError>`     |
| `inspect(actor)`                         | `Stream<InspectionEvent>`                                   |
| `deadLetters(actor)`                     | `Stream<DeadLetterInspectionEvent>`                         |

`send` and `waitFor` are dual: each takes the actor first, or returns a function of the actor so it can be piped.

```ts
yield* send(actor, { type: 'PAY' });
yield* pipe(actor, send({ type: 'PAY' }));
```

When `predicate` is a type predicate, `waitFor` narrows its result to the asserted snapshot type:

```ts
const snapshot = yield* waitFor(
  actor,
  (s): s is typeof s & { status: 'done' } => s.status === 'done'
);
```

The `timeout` failure is Effect's `Cause.TimeoutError`, not the `TimeoutError` that `xstate` exports for its own delayed-transition errors.

`snapshots` ends when the actor completes. If the actor errors, the stream emits the error snapshot and ends. `waitFor` and `join` fail with `ActorStoppedError` when the actor stops or errors before the awaited result; `join` fails with the actor's typed error when the actor's status is `error`.

```ts
const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(fetchUser, { input: { id: '42' } });
  const user = yield* join(actor);
  return user.id;
});
```

`send` returns `Effect<void>` and never fails. Delivery is synchronous, like `actor.send(event)`, and XState reports an event it could not deliver as a **dead letter** with a reason: `'stopped'` for a send to a stopped actor, `'invalidEvent'` for a payload the target's schema rejects, and `'internalEvent'` for an internal event type sent from outside its owning actor. A failing `send` could not carry that reason, and a dead letter is not an actor error. Observe them instead:

```ts
const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(machine);
  yield* Effect.forkScoped(
    Stream.runForEach(deadLetters(actor), (event) =>
      Effect.logWarning(`undelivered ${event.event.type}: ${event.reason}`)
    )
  );
});
```

## React

`useMachine`, `useActor` and `useActorRef` call `createActor` internally, so they cannot start Effect-backed logic. Create the actor through a `ManagedRuntime` or a Layer, then read it from React with `useSelector`, which takes an existing actor reference.

```tsx
import { Effect, ManagedRuntime } from 'effect';
import { send } from '@xstate/effect';
import { useSelector } from '@xstate/react';

const runtime = ManagedRuntime.make(AppLayer);
const actor = await runtime.runPromise(
  Effect.gen(function* () {
    return yield* CheckoutActor;
  })
);

function Checkout() {
  const status = useSelector(actor, (s) => s.value);

  return (
    <button onClick={() => runtime.runFork(send(actor, { type: 'PAY' }))}>
      {String(status)}
    </button>
  );
}
```

`actor.send` also works directly. Use `send` when the call site is already inside an Effect.

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
- Interruption from inside the Effect, such as `Effect.interrupt`: status `error` with an `EffectInterruptedError`. An `Effect.timeout` is a failure with `Cause.TimeoutError`, not an interruption; a lost `Effect.race` inside the Effect interrupts only the loser and the actor completes with the winner.

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

<!-- effect action contract from src/setupEffect.ts; spawn guard from src/internal.ts -->

In XState v6 an action is a plain function, and a transition enqueues it with the arguments it should run with: `enq(args.actions.audit, args)`. There is no implicit action context, so the transition passes `args` explicitly and the enqueue call stays synchronous. `setupEffect({ actions })` keeps that contract and adds one thing: the action returns an Effect, and that Effect is the asynchronous boundary. The action function itself is called synchronously during the transition. The Effect it returns runs in the actor's Effect context and is interrupted when the actor stops. Failures and defects route to the state's `onError`.

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

A declared action is defined before any machine uses it, so the enqueue object it receives is not typed with a machine's event union: `raise` accepts any event object. Raise events from the transition function when you want the machine's own event types.

### Declared only

Anything that touches the Effect context must be a declared action or a declared actor. Only declared sources contribute to the actor's requirements, so an inline Effect infers `R = never` and fails at runtime when a service is missing. Declared actions also carry a name for inspection and `machine.provide` overrides.

- Register Effect actions with `setupEffect({ actions })` and run them with `enq(args.actions.name, args)`.
- Register spawned Effect logic with `setup({ actors })` or `setupEffect({ actors })` and spawn it with `enq.spawn(args.actors.name)`. Spawning inline Effect logic is an error at runtime.
- Effect logic used inline as `invoke.src` runs and contributes to `RequirementsFrom`. Registering it in `actors` gives it a name.

> **Warning:** An inline action that returns an Effect does not run it. `enq(() => Effect.log('saved'))` creates the Effect and discards it, because XState only awaits returned promises. Register the action with `setupEffect({ actions })` instead.

Effect actions do not block the actor. The actor processes the next event while the Effect runs.

## Persistence

Effect-backed logic uses the normal XState persistence APIs. `actor.getPersistedSnapshot()` returns a serializable snapshot, and `createEffectActor(logic, { snapshot })` restores it.

```ts
const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(machine);
  const persisted = actor.getPersistedSnapshot();
  actor.stop();

  return yield* createEffectActor(machine, { snapshot: persisted });
});
```

A persisted snapshot records the actor's state, not the progress of a running Effect. Restoring a snapshot in which an Effect actor was still active runs its Effect or stream again from the start. Make those Effects idempotent, or persist from a state in which nothing is in flight.

## Testing

Machines keep their normal test surface, and this package adds Effect-native ways to drive and observe them.

Delays run on the Effect `Clock`, so `TestClock` advances `after` transitions and delayed sends without real time passing:

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

`createEffectActor` is an ordinary scoped Effect, so Effect's retry combinators supervise an actor. Wrap the actor and the work that depends on it in `Effect.scoped`, then retry that unit: each attempt builds a fresh actor and the failed attempt's actor is stopped when its scope closes.

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

<!-- error types from src/errors.ts; timeout failure from src/actor.ts -->

| Error                    | Raised by                                                                                      | Fields                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `ActorStoppedError`      | `waitFor`, `join` when the actor stops or errors before the awaited result                     | `actorId: string`, `snapshot: Snapshot<unknown>` |
| `EffectInterruptedError` | Effect logic interrupted from inside, such as `Effect.interrupt`, reported as `snapshot.error` | `cause: Cause.Cause<never>`                      |
| `Cause.TimeoutError`     | `waitFor` with `{ timeout }` when no snapshot matches in time                                  | Effect's own error; `_tag: 'TimeoutError'`       |

Both package errors are `Data.TaggedError` classes, so `Effect.catchTag('ActorStoppedError', …)` matches them.

The actor's own failures are not in this table. A `fromEffect` actor reports the Effect's `E` value as `snapshot.error`, typed through `ErrorFrom`, which this package re-exports from `xstate`.

## Tracing

<!-- span names and attributes from src/internal.ts and src/fromEffect.ts -->

Every Effect the actor hosts runs inside a span:

| Span                    | Covers                                   |
| ----------------------- | ---------------------------------------- |
| `fromEffect`            | a `fromEffect` actor's Effect            |
| `fromEffectStream`      | a `fromEffectStream` actor's stream      |
| `fromEffectEventStream` | a `fromEffectEventStream` actor's stream |
| `action.<name>`         | an Effect action registered as `<name>`  |

Each span carries the attributes `xstate.actor.id` and `xstate.actor.address`. `id` is the actor's own name. `address` is its `/`-joined path of ids from the root actor, which is stable across persistence and restore, so it identifies the same logical actor across runs.

Spans are recorded only when a `Tracer` is provided. Without one they cost nothing and export nothing.
