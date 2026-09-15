---
title: Actors
description: Create, scope and provide Effect-backed actors.
---

`createEffectActor(logic, options?)` starts actor logic as an Effect interpreter and returns `Effect<EffectActor<TLogic>, never, R | Scope>`, where `R` is the union of Effect services the logic requires.

```ts
const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(machine, { input: { orderId: '42' } });
  return actor.getSnapshot().value;
});
```

`options.input` is the actor's input, typed by the logic. It is required when the logic's input type does not include `undefined`, and optional otherwise.

The returned handle is an `EffectActor`. It implements XState's [actor reference](../create-actor.md) contract (`send`, `getSnapshot`, `subscribe`, `on`) and adds `inspect`, `getPersistedSnapshot` and `stop`, so the [actor functions](observing-actors.md) in this package, `useSelector` from `@xstate/react` and the inspection APIs all accept it.

## Lifetime

The actor is a scoped resource. It stops, and every Effect it hosts is interrupted, when the enclosing `Scope` closes. Use `Effect.scoped` to close the scope when the program finishes.

```ts
await Effect.runPromise(Effect.scoped(program));
```

Effects hosted by the actor see a `Scope` that closes when the actor stops. `Effect.addFinalizer` and `Effect.acquireRelease` inside those Effects release with the actor, not with the Effect that registered them.

Provide Layers outside `Effect.scoped`, so their resources are released after the actor has stopped:

```ts
await Effect.runPromise(program.pipe(Effect.scoped, Effect.provide(AppLayer)));
```

`actor.stop()` stops the actor and closes the actor's scope. The release step of `createEffectActor` waits for the actor scope's finalizers before the enclosing scope continues closing.

## Provide an actor as a service

An actor built by `createEffectActor` is a scoped Effect, so `Layer.effect` turns it into a service. Type the service as `EffectActor<typeof machine>`. The actor starts when the Layer is built and stops when the Layer's scope closes.

```ts
import { Context, Effect, Layer, ManagedRuntime } from 'effect';
import {
  createEffectActor,
  send,
  waitFor,
  type EffectActor
} from '@xstate/effect';

class CheckoutActor extends Context.Service<
  CheckoutActor,
  EffectActor<typeof checkoutMachine>
>()('@app/CheckoutActor') {}

const CheckoutActorLayer = Layer.effect(
  CheckoutActor,
  createEffectActor(checkoutMachine)
);
```

The Layer's requirements are the machine's requirements, so provide them as you would for any other Layer:

```ts
const AppLayer = CheckoutActorLayer.pipe(Layer.provide(PaymentsLayer));
```

At an edge that is not itself an Effect, build the Layer once with a `ManagedRuntime` and run individual Effects against it:

```ts
const runtime = ManagedRuntime.make(AppLayer);

const paid = await runtime.runPromise(
  Effect.gen(function* () {
    const actor = yield* CheckoutActor;
    yield* send(actor, { type: 'PAY' });
    return yield* waitFor(actor, (s) => s.matches('paid'));
  })
);

await runtime.dispose();
```

`runtime.dispose()` closes the runtime's scope, which stops the actor and releases the Layers it was built from. Call it when the process shuts down.

## Clock

XState timers, meaning [`after` transitions](../delays.md) and delayed sends, use the Effect `Clock` service. In production this is the live clock. In tests, `TestClock` from `effect/testing` drives them without real time passing.

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

Timers are fibers in the actor's scope, so they are interrupted when the actor stops. See [testing and errors](testing-and-errors.md) for a full test.

## Requirements

`RequirementsFrom<TLogic>` is the `R` channel of `createEffectActor`. It collects the requirements of:

- actions registered with `setupEffect({ actions })`,
- actors registered with `setup({ actors })` or `setupEffect({ actors })`,
- logic used inline as `invoke.src`, at the root or in any state,
- all of the above inside child machines, whether registered or invoked inline, up to 10 levels of machine nesting.

Past 10 levels the type stops recursing and contributes `never`. Requirements introduced deeper than that are not part of `R`, so TypeScript accepts a program that does not provide the service and the actor fails at runtime when the service is requested. Flatten the machine tree, or provide those services explicitly, if a machine nests that deeply.

`never` in the `R` channel means that no requirement was collected, not that no failure is possible. `createEffectActor` has no typed failures at all. Starting Effect-backed logic outside `createEffectActor`, spawning undeclared Effect logic, and using a service that was not collected are programming errors: they surface as the actor's `error` status, not as an Effect failure. Input rejected by a runtime `validator` is thrown while the actor is created, so `createEffectActor` dies with that error as a defect.

Logic passed inline to `enq.spawn` lives inside a transition function body and is invisible to the type, so spawning inline Effect logic is rejected at runtime. Spawn a declared actor instead. See [declared only](schemas-and-actions.md#declared-only).
