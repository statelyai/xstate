# @xstate/effect

## 0.1.0-alpha.4

### Patch Changes

- 8576291: Remove the `@xstate.deadletter` inspection event; observe undelivered events with the `onRejectedEvent` option. The inspection protocol is now exactly `@xstate.actor` and `@xstate.transition`. In `@xstate/effect`, `deadLetters(actor)` now streams `EventRejection` objects.
  
  ```ts
  createActor(machine, {
    onRejectedEvent: (rejection) => {
      console.log(rejection.event.type, rejection.reason, rejection.issues);
    }
  });
  ```
  
  Undelivered events are also available through `system.onRejectedEvent(listener)`, which accepts any number of listeners added at any time and returns a subscription. The `onRejectedEvent` option registers a listener the same way.
  
  ```ts
  const subscription = actor.system.onRejectedEvent((rejection) => {
    console.log(rejection.event.type, rejection.reason);
  });
  subscription.unsubscribe();
  ```

## 0.1.0-alpha.3

### Patch Changes

- f5ea38e: Clarify that joining a machine exposes unknown errors, distinguish stopped actors from failed actors, and provide a typed oxlint plugin for strict TypeScript projects.

## 0.1.0-alpha.2

### Minor Changes

- dcc21df: Add experimental Effect 4 integration for XState v6.
  
  - `createEffectActor(logic)` starts an actor as a scoped Effect resource: it stops, and its running Effects are interrupted, when the enclosing `Scope` closes. Delays run on the Effect `Clock`, so `TestClock` drives delayed transitions, and declared Effect actions run with the services in scope. It returns an `EffectActor` handle that implements XState's `ActorRef` contract; `send` enqueues the event and the actor processes it on its own fiber.
  - `fromEffect`, `fromEffectStream` and `fromEffectEventStream` turn Effects and Streams into actor logic with typed failures and service requirements. Interruption from inside the Effect reports an `EffectInterruptedError`.
  - `setupEffect` accepts Effect schemas and Effect-returning actions.
  - `@xstate/effect/atom` exports `createActorAtoms`, which runs an actor in an `Atom.runtime` from `effect/unstable/reactivity` and exposes `actor`, `snapshot`, `send` and `select` atoms for reactive UIs such as `@effect/atom-react`.
  - `taggedState(snapshot)` and `TaggedState<typeof machine>` view a machine snapshot as a tagged union over its states, with `_tag` as the dotted state path and `context` narrowed to that state, for `Match.tag` and `Match.exhaustive`. The `state` atom from `createActorAtoms` exposes the same view.
  - `send`, `snapshots`, `emitted`, `waitFor`, `join`, `inspect` and `deadLetters` expose an actor as Effects and Streams. `send` and `waitFor` are dual, so they take the actor first or can be piped. `waitFor` narrows its result when given a type predicate, and accepts a `timeout` that fails with `Cause.TimeoutError`. `join` waits for an actor's final output. `deadLetters` streams the events the actor's system could not deliver.
  
  ```ts
  import { Effect, Schema } from 'effect';
  import { createEffectActor, fromEffect, join } from '@xstate/effect';
  
  const loadUser = fromEffect({
    schemas: {
      input: Schema.Struct({ id: Schema.String }),
      output: Schema.Struct({ id: Schema.String })
    },
    effect: ({ input }) => Effect.succeed({ id: input.id })
  });
  
  const program = Effect.gen(function* () {
    const actor = yield* createEffectActor(loadUser, { input: { id: '42' } });
    return yield* join(actor);
  });
  
  await Effect.runPromise(Effect.scoped(program));
  ```
