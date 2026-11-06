---
title: Troubleshooting
description: Fix common problems when building with XState.
---

## An event does nothing

Check the current snapshot and transitions defined for that state. Events without matching transitions are ignored.

## Context did not update

Return the next context from the transition function. Do not mutate `context` and return nothing.

## An async request keeps running

Pass the `signal` from `createAsyncLogic(...)` to the async API.

## A restored actor starts from the beginning

Create the actor with `restoreActor(logic, persistedSnapshot)` from `xstate/persist` instead of `createActor(logic)`, then call `start()`.

## A nested state comparison fails

Use `snapshot.matches(...)` instead of comparing `snapshot.value` to a string.

## TypeScript accepts the wrong event

Define event schemas and send event objects. The `actor.trigger` helpers are generated from those schemas.

## Error: Transition "…" in state "…" uses "cond", which was removed

The config uses a v5 guard. Replace the transition object with an inline transition function that returns `{ target }` when the condition passes and `undefined` otherwise. Check the condition before any `enq` call: a function that calls `enq` is taken even if it returns `undefined`. The same fix applies to `uses an object-form "guard", which was removed`. Named guards are available as `guards.name(...)` in the function's arguments. See [Guards](guards.md).

## Error: Transition "…" in state "…" uses "actions", which was removed

Move the effects into an inline transition function `(args, enq) => { ... }`. Call named actions with `enq(actions.name, params)`. See [Actions](actions.md).

## Error: State "…" has a string (or an array) as "entry", which is not supported

`entry` and `exit` take a single function in v6. Combine the effects into one `(args, enq) => { ... }` function and call named actions with `enq(actions.name, params)`.

## Error: "types" was replaced by "schemas"

Move the contracts from `types`, `tsTypes`, or `schema` to `schemas`. Use `types<T>()` inside `schemas` for type-only contracts, or run `xstate-codemod migrate --transform types-to-schemas`. See [Migrate from XState v5 to v6](xstate-v5-to-v6.md#28-leftover-v5-keys).

## Error: "services" was renamed, "devTools" was removed, or "activities" was removed

`createMachine` throws on these v5 keys in every build. Provide actor logic under `actors` instead of `services`, pass the `inspect` option to `createActor` instead of `devTools`, and replace `activities` with `invoke`. The error names the replacement.

## Error: Unknown actor option "…"

`createActor` throws on an option it does not support, in every build. Removed options name their replacement: `restoreActor(...)` from `xstate/persist` for `state` and `snapshot`, `registryKey` for `systemId`, and `inspect` for `devTools`. The message for any other key lists the supported options.

## Warning: Machine config "…" was removed

`predictableActionArguments`, `preserveActionOrder`, and `strict` have no effect in v6. Development builds warn about them. Remove the key.
