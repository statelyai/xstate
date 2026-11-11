# @xstate/effect

## 1.0.0-beta.1

### Major Changes

- 3cbcc3f: Serialized output no longer uses field names that start with `$` or `_`. Stores such as Convex reject both prefixes, and MongoDB restricts `$`-prefixed field names, so persisted snapshots, `systemTransition` snapshots and effect descriptors could not be stored without rewriting them.
  
  | Before                    | After                    | Where                                                                                                      |
  | ------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------- |
  | `{ $actor: address, incarnation }` | `{ '@actor': address, incarnation }` | `SerializedActorRef`: persisted context, `systemTransition` snapshots, effect descriptors, `sendTo` targets, dead letters, `@xstate/effect` actor `toJSON()` |
  | `_nextTimerId`            | `nextTimerId`            | Persisted snapshots, `systemTransition` snapshots                                                          |
  | `_nextActorIds`           | `nextActorIds`           | Persisted snapshots, `systemTransition` snapshots                                                          |
  | `_stateInputs`            | `stateInputs`            | `systemTransition` snapshots (persisted snapshots already used `stateInputs`)                              |
  | `{ $error: name, message }` | `{ '@error': name, message }` | `systemTransition` snapshots, `@xstate/test` traces                                                        |
  | `{ $stateNode: id }`, `{ $systemMapper: key }` | `{ '@stateNode': id }`, `{ '@systemMapper': key }` | `systemTransition` snapshots                                                                        |
  
  ```ts
  // Before
  { $actor: 'order/worker', incarnation: 'a:1' }
  // After
  { '@actor': 'order/worker', incarnation: 'a:1' }
  ```
  
  `snapshot.toJSON()` no longer includes the private `_nextTimerId` and `_nextActorIds` counters.
  
  Snapshots written by `6.0.0-beta.1` with the old field names still restore: `restoreActor`, `restoreMachineSnapshot` and `systemTransition` read both shapes. New snapshots use only the new names. Schemas that validate persisted snapshots (for example with `machineVersions`) must use the new names.

### Minor Changes

- bddb8a6: Export `sendAndAwait` from the main `@xstate/effect` entrypoint. `@xstate/effect/test` still re-exports it for compatibility. Document its one-event acknowledgment boundary: the transition and immediate effects, without awaiting child replies or background work.

### Patch Changes

- d56483f: `createEffectActor` now shows observers each step in the order that `createActor` uses. The events that a transition emits come first. Then an active step gives `next`, a `done` step gives `next` and then `complete`, and an `error` step gives `error`. `join` resolves, and the `emitted(actor)` stream ends, after the events of the final transition.
  
  A `stop()` that an `on` listener or an observer calls synchronously while the actor delivers a step now runs when that step ends, as in `createActor`. A `stop()` from anywhere else still stops the actor at once. If the step ends the actor with `done` or `error`, its `sendAndAwait` receipt now succeeds with that snapshot, also when a listener stopped the actor during the step.
- 389a4a2: Preserve registered Effect action keys in transition descriptors so consumers can identify enqueued actions.

## 1.0.0-beta.0

### Patch Changes

- 6cf6982: XState v6 enters beta. No further breaking changes are planned for APIs tagged `@public`; any that are needed will be called out with a migration path. APIs tagged `@experimental` may still change.

## 1.0.0-alpha.12

### Patch Changes

- ce9fab5: Public exports now carry `@public` or `@experimental` stability tags.

## 1.0.0-alpha.11

### Patch Changes

- 129fd6b: Events sent by a child actor to a parent started with `createEffectActor` now retain their send order, including bursts from promise continuations.
  
  Durable hosts with a single FIFO mailbox can route all root events through their adapter:
  
  ```ts
  const durable = createDurable(machine, adapter, { captureRootEvents: false });
  ```

## 1.0.0-alpha.10

### Minor Changes

- a99e096: Preserve complete Effect Causes in task, stream and hosted action failures. Error snapshots and invoked child `onError` events now carry `EffectFailure<E>`; inspect `error.cause` instead of reading domain error properties directly. `join` and result atoms preserve typed failures, defects and interruption.
  
  Add `createSnapshotCodec(machine, schema)` for validated JSON persistence with explicit rich-value schemas and existing machine migrations. Add `sendAndAwait` from `@xstate/effect/test` to acknowledge a specific mailbox event, including ignored events, and integrate with async `@xstate/test` SUT sessions.
  
  Expose the `state` atom only for machine logic. Update Effect 4 compatibility and installation guidance.
  
  ```ts
  const snapshot = yield* sendAndAwait(actor, event);
  const json = yield* codec.encode(actor.getPersistedSnapshot());
  const restored = yield* codec.decode(json);
  ```
- 70c5866: Add the compiled `@xstate/effect/oxlint` plugin. Enable `xstate-effect/no-inline-effect` to catch discarded inline Effects and unsupported inline spawned Effect logic without copying a rule from the repository.
  
  `@xstate/effect` keeps zero direct runtime dependencies. Install the optional lint tools as development dependencies before enabling the plugin:
  
  ```sh
  npm install --save-dev oxlint@^1.76.0 @oxlint/plugins@^1.76.0
  ```
  
  ```json
  {
    "jsPlugins": ["@xstate/effect/oxlint"],
    "rules": {
      "xstate-effect/no-inline-effect": "error"
    }
  }
  ```

### Patch Changes

- 1db8c66: Interrupting the fiber that owns an actor created with `createEffectActor` now waits for the finalizers of Effects invoked by that actor, even when the owner is interrupted immediately after the invoked Effect starts.
- 58b0f81: Exported `setupEffect(...)` results and machines created from them now emit portable declarations. Previously, `declaration: true` builds failed with TS4023 or TS2883 when exporting them without a type annotation.
  
  ```ts
  export const machine = setupEffect({
    actions: { audit: (_args) => Effect.void }
  }).createMachine({});
  ```
- 87a6d33: Infer declared Effect action arguments from setup schemas, including decoded context types, public and internal events, and merged extension schemas. Actions without context schemas receive `unknown` context values instead of implicit `any`.
  
  Declare custom action arguments with `schemas.actions.<name>.params`. This schema describes the whole first argument. Include the owning `self` when enqueueing the action:
  
  ```ts
  const machine = setupEffect({
    schemas: {
      actions: {
        audit: { params: Schema.Struct({ message: Schema.String }) }
      }
    },
    actions: {
      audit: ({ message }) => Effect.log(message)
    }
  }).createMachine({
    on: {
      SAVE: (args, enq) =>
        enq(args.actions.audit, { self: args.self, message: 'saved' })
    }
  });
  ```

## 1.0.0-alpha.9

### Major Changes

- ceeebb0: `taggedState(...)` tags a root parallel state with the machine `id` instead of `'(machine)'`, or with `''` when the machine has no id. `TaggedState` and `StateTag` type the tag the same way.
  
  ```ts
  const release = createMachine({ id: 'release', type: 'parallel', states: { review: {}, build: {} } });
  
  Match.type<TaggedState<typeof release>>().pipe(
    Match.tag('release', () => 'in progress'), // was Match.tag('(machine)', ...)
    Match.exhaustive
  );
  ```

## 1.0.0-alpha.8

### Major Changes

- d2c518b: Effect logic creators follow the core `create*Logic` naming:
  
  | Before                  | After                          |
  | ----------------------- | ------------------------------ |
  | `fromEffect`            | `createEffectLogic`            |
  | `fromEffectStream`      | `createEffectStreamLogic`      |
  | `fromEffectEventStream` | `createEffectEventStreamLogic` |
  
  `EffectActor#toJSON()` returns `{ $actor: address }`, like core actors.

## 0.1.0-alpha.7

### Patch Changes

- 902becb: `createEffectActor` accepts a persisted snapshot. The actor resumes in the persisted state and context without re-running entry actions, and pending delayed transitions keep their original deadlines on Effect's `Clock`.
  
  ```ts
  const saved = actor.getPersistedSnapshot();
  // later, possibly in another process
  const restored = yield* createEffectActor(machine, { snapshot: saved });
  ```
  
  State-machine children resume their persisted state, and completed children do not restart. Running Effect tasks and streams, including a root `fromEffect` or `fromEffectStream` actor, restart from the beginning, as running async and callback actors do with XState's `createActor(logic, { snapshot })`. A snapshot-only restore does not need `input`.

## 0.1.0-alpha.6

### Patch Changes

- e6bb41e: Require stable Effect 4 (`^4.0.0`) instead of the Effect 4 release candidate.
  
  Update atom integration to use Effect 4’s `effect/reactivity` module.

## 0.1.0-alpha.5

### Patch Changes

- 5228c00: Infer the current service requirements of actions and actors replaced with `machine.provide`. Require declared actor input in `createActorAtoms`, consistently with `createEffectActor`.
  
  Effect tasks and streams now release their resources when they complete, fail or are cancelled. Actor shutdown waits for task cleanup before releasing resources shared for the actor's lifetime. Use `withActorScope` around an acquisition to keep its resource until the owning Effect actor stops:
  
  ```ts
  import { Effect } from 'effect';
  import { withActorScope } from '@xstate/effect';
  
  const session = Effect.acquireRelease(
    Effect.succeed({ id: 'session' }),
    () => Effect.log('Session closed')
  ).pipe(withActorScope);
  ```
  
  Improve XState Effect guides with complete, tested workflow, stream, inspection and React examples.

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
