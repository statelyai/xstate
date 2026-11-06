---
title: Error codes
description: Look up the XState E-codes that production builds report, with the development message, cause, and fix for each.
---

Development builds of XState throw and warn with full messages. Production builds replace each message with a short code, the values that identify the failing state, event, or actor, and a link to this page:

```text
XState error E1 ("services"). See https://github.com/statelyai/xstate/blob/next/docs/errors.md#e1
```

The values in parentheses fill the placeholders of the development message, in the order listed under each code. To see the full message, run the code under the `development` condition (for example, with Vite or webpack in development mode, or `node --conditions=development`).

Error classes and names do not change between builds. For example, a restore failure is an `InvalidSnapshotError` in both builds. Codes are stable: a code is never reused for a different error.

## E1

```text
"types" was replaced by "schemas". ...
"tsTypes" (typegen) was removed. ...
"schema" was replaced by "schemas". ...
The top-level "internalEvents" list was removed. ...
"services" was renamed. ...
"devTools" was removed. ...
```

Values: the config key.

A machine config contains a v5 key that v6 removed. v6 would otherwise ignore or misread it.

| Key | Replacement |
| --- | --- |
| `types` | Declare contracts under `schemas` (or `setup({ schemas })`). Use `types<T>()` inside `schemas` for type-only contracts. |
| `tsTypes` | Remove it. Declare contracts under `schemas`. |
| `schema` | Rename it to `schemas`. |
| `internalEvents` | Declare private events under `schemas.internalEvents`, for example `schemas: { internalEvents: { tick: types<{}>() } }`. |
| `services` | Provide actor logic under `actors` (or `setup({ actors })`). |
| `devTools` | Pass the `inspect` option to `createActor(...)`. |

## E2

```text
setup() has no "internalEvents" option. Declare private events under `schemas.internalEvents` instead, e.g. `setup({ schemas: { internalEvents: { tick: types<{}>() } } })`.
```

A `setup(...)` config contains `internalEvents`. Move the declarations to `setup({ schemas: { internalEvents } })`.

## E3

```text
Transition "{eventType}" in state "{stateId}" never fires: v6 lifecycle event types carry the id in a payload field instead of the type. {replacement}.
```

Values: the event type, the state id.

A transition is keyed on a v5 lifecycle event type with an id suffix, such as `xstate.done.actor.fetch` or `xstate.after.1000.timer`. v6 lifecycle events carry the id in the event payload, so the key never matches.

Fix it according to the category:

- `xstate.after.*`: use `after: { <delay>: ... }` on the state, or key on `xstate.after` and select `matches: { stateId, delay }`.
- `xstate.done.state.*`: use `onDone` on the state, or key on `xstate.done.state` with `matches: { stateId }`.
- `xstate.done.actor.*`, `xstate.error.actor.*`, `xstate.snapshot.*`: use the invoke's `onDone`, `onError`, or `onSnapshot`, or key on the category type (`xstate.done.actor`, `xstate.error.actor`, `xstate.snapshot.actor`) with `matches: { actorId }`.

## E4

```text
Transition "{eventType}" in state "{stateId}" uses "cond", which was removed. ...
Transition "{eventType}" in state "{stateId}" uses an object-form "guard", which was removed. ...
Transition "{eventType}" in state "{stateId}" uses "actions", which was removed. ...
```

Values: the event type, the state id, the removed key (`cond`, `guard`, or `actions`).

A transition object uses a v5 key. Replace the transition with an inline transition function:

- Guards (`cond`, object-form `guard`): return `{ target }` when the condition passes, or `undefined` to reject the event, before any `enq` call. Named guards are available as `guards.name(...)` in the function's arguments.
- `actions`: queue effects on `enq`, for example `(args, enq) => { enq(actions.name, params); }`.

## E5

```text
Initial transition of state "{stateId}" uses "cond", which was removed. ...
Initial transition of state "{stateId}" uses an object-form "guard", which was removed. ...
Initial transition of state "{stateId}" uses "actions", which was removed. ...
```

Values: the state id, the removed key (`cond`, `guard`, or `actions`).

An `initial` transition object uses a v5 key. Initial transitions cannot be guarded; use an `always` transition on the target state to redirect conditionally. To run effects, use a `to: (args, enq) => { ... }` function on the initial transition, or an `entry` function on the target state.

## E6

```text
State "{stateId}" uses "activities", which was removed. Invoke an actor with "invoke" instead.
```

Values: the state id.

A state config contains the v5 `activities` key. Model each activity as an invoked actor with `invoke`.

## E7

```text
State "{stateId}" has {shape} as "{key}", which is not supported. Use a single inline function `(args, enq) => { ... }`; call named actions with `enq(actions.name, params)`.
```

Values: the state id, the key (`entry` or `exit`).

A state's `entry` or `exit` is an array, a string, or another non-function value. Replace it with one function and call named actions on `enq`.

## E8

```text
The "{key}" actor option was removed. ...
Unknown actor option "{key}". Supported options: clock, logger, syncSnapshot, id, registryKey, input, src, inspect, onRejectedEvent, onUnhandledEvent.
```

Values: the option name.

`createActor(logic, options)` or `restoreActor(logic, snapshot, options)` received an option that v6 does not read. Removed options and their replacements:

| Option | Replacement |
| --- | --- |
| `parent` | Create child actors through `invoke`, `spawn`, or `enq.spawn`. |
| `systemId` | Use `registryKey`, and look the actor up with `system.get(registryKey)`. |
| `state` | Restore with `restoreActor(logic, snapshot)` from `xstate/persist`. |
| `snapshot` | Restore with `restoreActor(logic, snapshot)` from `xstate/persist`. |
| `devTools` | Pass the `inspect` option. |
| `deferEvents` | Remove it. Events sent before `start()` are always queued until the actor starts. |
| `execute` | Remove it. Effects always run when the actor processes an event; use `transition()` for pure steps. |

For any other name, check the spelling against the supported options.

## E9

```text
Invalid delay "{delay}": not a configured delay name or a valid duration string (e.g. "500ms", "1.5s", "PT1M30S").
```

Values: the delay.

A delay is neither a name in the machine's `delays` nor a parseable duration. Register the name in `setup({ delays })` or the machine config, or use a duration string such as `"500ms"`, `"1.5s"`, or `"PT1M30S"`.

## E10

```text
Transition "{eventType}" in state "{stateId}" uses {removedKey}, which was removed in v6. Use a transition function.
```

Values: the event type (`always` for eventless transitions), the state id, the removed key.

A transition config reached transition resolution with `cond`, `actions`, or an object-form `guard`, without passing the creation-time check that reports [E4](#e4). Replace the transition with a transition function, as described in [E4](#e4).

## E11

```text
Invalid transition definition for state node '{stateId}': target set is not a legal SCXML configuration.
```

Values: the source state id.

A transition targets several states that cannot be active together. Multiple targets must be descendants of different regions of the same parallel state. Target one state, or target states in sibling regions of a parallel state.

## E12

```text
Invalid transition definition for state node '{stateId}':
{reason}
```

Values: the state id, the underlying error message.

A sibling-relative transition target could not be resolved. The second value is the underlying error (often [E14](#e14)). Check the target key against the sibling state names, or target the state by id with `#id`.

## E13

```text
Invalid target: "{target}" is not a valid target from the root node. Did you mean ".{target}"?
```

Values: the target.

A transition on the root state targets a state by key, but the root has no siblings. Prefix the key with `.` to target a child of the root, or target the state by id with `#id`.

## E14

```text
Child state '{stateKey}' does not exist on '{stateId}'
State '{stateKey}' does not exist on '{stateId}'
Unable to retrieve child state '{stateKey}' from '{stateId}'; no child states exist.
```

Values: the state key, the parent state id.

A target path or state value names a child state that the parent does not define. Check the key and the nesting of the path.

## E15

```text
Actor logic '{src}' not implemented in machine '{machineId}'
```

Values: the source key, or `"inline"`.

An invoke or spawn names an actor source that the machine does not provide. Register it in `setup({ actors })` or pass it to `machine.provide({ actors })`.

## E16

```text
Infinite loop detected in actor "{actorId}" processing event "{eventType}": more than {maxIterations} microsteps without reaching a stable state. Last states: {states}. Check for a cycle of eventless transitions or raised events, or raise the bound with createMachine({ options: { maxIterations } }).
```

Values: the actor id, the event type, the microstep bound.

The error is an `InfiniteTransitionError`. Processing one event took more microsteps than the bound allows, which usually means `always` transitions or raised events form a cycle. Break the cycle with a guard that eventually rejects, or raise the bound with `createMachine({ options: { maxIterations } })` when the long macrostep is intended.

## E17

```text
Transition functions must be synchronous. Transition for event "{eventType}" in state "{stateId}" returned a promise. Move async work into an invoked or spawned actor, or enq.effect.
Entry functions must be synchronous. The entry function of state "{stateId}" returned a promise (event "{eventType}"). ...
Exit functions must be synchronous. The exit function of state "{stateId}" returned a promise (event "{eventType}"). ...
```

Values: the function kind (`transition`, `entry`, or `exit`), the state id, the event type.

A transition, entry, or exit function is `async` or returned a promise. These functions must return synchronously. Move async work into an invoked or spawned actor, or into `enq.effect(...)`.

## E18

```text
Machine with version '{version}' must declare an id.
```

Values: the version.

The machine config has a `version` but no `id`. Persisted snapshots record both, so add an `id` to the machine config.

## E19

```text
State id '#' is empty. Target the root of machine '{machineId}' with '#{machineId}'.
State id '#' is empty: the root of a machine without an `id` cannot be referenced by id. Give the machine an `id` to reference its root as '#<id>'.
```

Values: the machine id (empty when the machine has none).

A target or lookup uses `#` with no id. Target the root with `#<machine id>`, and give the machine an `id` if it has none.

## E20

```text
No state has id "{id}".
No state has id "{id}". Use "#{suggestedId}".
```

Values: the id.

A `#id` target or `getStateNodeById(...)` lookup matches no state. In development, the message suggests the id of a state that matches when part of the id is a state id followed by a relative path. Use that state's id, or give the state an explicit `id`.

## E21

```text
Persisted snapshot references state '{path}' which does not exist on machine '{machineId}'.
```

Values: the state path.

The error is an `InvalidSnapshotError`. The persisted state value names a state that the current machine does not define, usually because the machine changed after the snapshot was saved. Give the machine a `version` and a `migrate(persistedSnapshot, fromVersion)` function, or discard the snapshot.

## E22

```text
Persisted snapshot for machine '{machineId}' has an invalid state value at '{path}': expected a state name or an object of state values.
```

Values: the state path (empty for the root).

The error is an `InvalidSnapshotError`. The persisted state value is not a string or an object at the given path. Persist snapshots with `actor.getPersistedSnapshot()` and restore them unchanged.

## E23

```text
Persisted snapshot for machine '{machineId}' has an invalid state value at '{path}': state '{path}' is not parallel, so only one child state can be active.
```

Values: the state path (empty for the root).

The error is an `InvalidSnapshotError`. The persisted state value lists several active children of a state that is not parallel. Restore a snapshot that matches the machine, or migrate it.

## E24

```text
Persisted snapshot for machine '{machineId}' must be an object.
```

Values: the machine id.

The error is an `InvalidSnapshotError`. `restoreActor(machine, snapshot)` received a value that is not an object. Pass the object from `getPersistedSnapshot()`; parse it first if it was stored as JSON.

## E25

```text
Persisted snapshot for machine '{machineId}' has no state value.
```

Values: the machine id.

The error is an `InvalidSnapshotError`. The persisted snapshot has no `value`. Restore a snapshot produced by `getPersistedSnapshot()`.

## E26

```text
Persisted snapshot has invalid 'children'.
```

The error is an `InvalidSnapshotError`. The persisted snapshot's `children` is missing or not an object. Restore a snapshot produced by `getPersistedSnapshot()`.

## E27

```text
Persisted snapshot has invalid child '{childId}'.
```

Values: the child id.

The error is an `InvalidSnapshotError`. A persisted child entry has fields of the wrong type, or a `src` that is neither a source key nor actor logic. Restore a snapshot produced by `getPersistedSnapshot()`.

## E28

```text
Unable to restore remote child '{childId}': a child referenced by address requires a registered source key and an address.
```

Values: the child id.

A persisted remote child has no string `src` or no `address`. Remote children restore from their source key and address alone. Register the child's logic under a key in `actors` so the snapshot records it.

## E29

```text
Unable to restore child actor '{childId}': child source '{src}' is not provided in machine '{machineId}'.
```

Values: the child id, the source key.

The persisted snapshot references a child whose source key the machine does not provide. Provide the logic under the same key in `setup({ actors })` or `machine.provide({ actors })` before restoring.

## E30

```text
Unable to restore child actor '{childId}'.
```

Values: the child id.

The error is an `InvalidSnapshotError`. Resolving a persisted child's logic threw a non-`Error` value. Check the code that resolves the child's `src`.

## E31

```text
Persisted snapshot has invalid 'timers'.
```

The error is an `InvalidSnapshotError`. The persisted snapshot's `timers` is not an array. Restore a snapshot produced by `getPersistedSnapshot()`.

## E32

```text
Persisted snapshot has invalid timer.
```

The error is an `InvalidSnapshotError`. A persisted timer entry is missing its delay, event, or target, or has fields of the wrong type. Restore a snapshot produced by `getPersistedSnapshot()`.

## E33

```text
Unable to restore timer: target actor '{target}' is unavailable.
Unable to restore timer '{timerId}': target actor '{target}' is unavailable.
```

Values: the timer's target.

The error is an `InvalidSnapshotError`. A persisted timer targets a child that is not in the restored snapshot. Restore the full snapshot, including the target child.

## E34

```text
Persisted snapshot version '{legacyVersion}' conflicts with machine version '{version}'.
```

Values: the snapshot's top-level version, the version recorded in its `machine` field.

The persisted snapshot records two different versions. Restore an unmodified snapshot from `getPersistedSnapshot()`.

## E35

```text
Machine ID mismatch: persisted snapshot was created by machine '{snapshotMachineId}', but machine '{machineId}' was provided.
```

Values: the machine id in the snapshot, the machine id of the restoring machine.

A snapshot is being restored into a different machine. Restore it with the machine that persisted it.

## E36

```text
Persisted snapshot version '{snapshotVersion}' does not match machine version '{version}' for machine '{machineId}'. Provide a `migrate(persistedSnapshot, fromVersion)` function in the machine config to migrate old snapshots.
```

Values: the snapshot's version, the machine's version.

The machine's `version` changed after the snapshot was saved. Add a `migrate(persistedSnapshot, fromVersion)` function to the machine config that returns a snapshot for the current version.

## E37

```text
Invalid {kind} name '{name}': the 'xstate.' and '@xstate.' prefixes are reserved for built-in names.
```

Values: the source kind (`actions`, `guards`, `actors`, or `delays`), the name.

A source name starts with `xstate.` or `@xstate.`, which are reserved for built-in events, effects, and sources. Rename it.

## E38

```text
Transition for "{eventType}" in state "{stateId}" is the string "{target}". Use { target: '{target}' }. The @xstate/codemod string-targets transform rewrites these.
```

Values: the event type, the state id, the target.

A transition is a bare string, which v6 does not accept. Write it as `{ target: '...' }`, or run the `@xstate/codemod` `string-targets` transform.

## E39

```text
Unable to restore child actor '{childId}': it has no source key, and no active state of machine '{machineId}' invokes it.
Unable to restore child actor '{childId}': it has no source key, and several active states of machine '{machineId}' invoke it.
```

Values: the child id.

A persisted child has no source key, so its logic must come from exactly one active invoke with that id. Give the invoke a registered `src` key, or make the invoke id unique among the active states.

## E40

```text
Unable to restore child actor '{childId}': its invoke resolves `src` with a function that returned inline logic. Register the logic in `actors` and return its key so the child persists by source key.
```

Values: the child id.

An invoke's `src` function returned actor logic instead of a key. Register the logic in `actors` and return its key from the function.

## E41

```text
An inline child actor cannot be persisted.
```

Values: the child id.

`getPersistedSnapshot()` found a spawned child created from inline logic. A restored snapshot could not recreate it. Register the logic in `setup({ actors })` and spawn it by key.

## E42

```text
Unable to persist child '{childId}' by address: it requires a registered source key.
```

Values: the child id.

A child persisted by address has no registered source key, so the snapshot could not be restored. Register the child's logic under a key in `actors` and create the child by key.

## E43

```text
Unable to persist timer '{timerId}': target actor '{actorId}' is no longer addressable from this snapshot.
```

Values: the target actor id.

A pending delayed event targets an actor that is neither a child nor the parent of the persisted actor. Target a child, the parent, or the actor itself, or cancel the timer before persisting.

## E44

```text
Cannot persist actor "{actorId}": circular reference at {path}
```

Values: the actor id, the path in context.

The actor's context contains a circular reference. Persisted snapshots must be JSON-serializable. Remove the cycle, or store an id in context instead of the object.

## E45

```text
Actor with registry key '{registryKey}' already exists.
```

Values: the registry key.

Two actors in one system use the same `registryKey`. Registry keys are unique per system. Use a different key, or stop the first actor before creating the second.

## E46

```text
Persisted snapshot must be an object.
```

`restoreActor(logic, snapshot)` received a snapshot that is not an object (`null`) for logic that has no `restoreSnapshot`. Pass the object from `getPersistedSnapshot()`; parse it first if it was stored as JSON.

## E47

```text
Cannot stop child actor {childId} of {actorId} because it is not a child
```

Values: the actor id to stop, the parent actor id.

An actor tried to stop an actor that is not its child. Stop children from their parent, or stop a root actor with `actor.stop()`.

## E48

```text
Actor {actorId} was stopped and cannot be restarted. Create a new actor with createActor().
```

Values: the actor id.

`start()` was called on a stopped actor. Create a new actor with `createActor(...)`. To resume from where it stopped, pass its persisted snapshot as `snapshot`.

## E49

```text
A non-root actor cannot be stopped directly.
```

Values: the actor id.

`stop()` was called on a child actor. Stop children from the parent, for example by leaving the state that invokes them or with `enq.stop(...)`.

## E50

```text
Unable to send event to actor '{address}': no live actor has that address
Unable to send event to actor '{address}' (incarnation '{incarnation}'): no live actor has that address and incarnation
```

Values: the address, and the incarnation when the reference has one.

A serialized actor reference (`{ $actor }`) points to an actor that is not running in this system, or to an earlier incarnation of it. Check that the actor is running, or refresh the stored reference.

## E51

```text
Cannot serialize actor ref '{actorId}': it was returned by a spawn during speculative transition evaluation, which creates no actor and has no parent address.
```

Values: the actor id.

A reference from a spawn during speculative evaluation (for example, `snapshot.can(...)` or a pure `transition(...)` call without an actor) was serialized. No actor exists for it. Serialize references from a running actor.

## E52

```text
Remote actor '{address}' has no local mailbox to receive "{eventType}". Its state lives with another runtime; install a runtime that can reach it (via `createDurable`'s adapter runtime operations, or `system.runtime`) before sending, or restore this snapshot with embedded children on the runtime that owns them.
```

Values: the address, the event type.

An event was delivered to a remote actor handle, but no runtime in this process can reach it. Install a runtime that can reach the actor, or restore the snapshot with embedded children on the runtime that owns them.

## E53

```text
Cannot persist remote actor '{address}' from here: its state lives with the runtime that owns it. Persist it there, or restore this snapshot with embedded children on the runtime that owns them.
```

Values: the address.

`getPersistedSnapshot()` was called on a remote actor handle. Persist the actor on the runtime that owns it.

## E54

```text
Cannot stop remote actor '{address}' directly: stopping is a co-located operation. Stop it through the system runtime that owns it (`system.stopActor(ref)`), or restore this snapshot with embedded children on the runtime that owns them.
```

Values: the address.

`stop()` was called on a remote actor handle. Stop it through the owning runtime with `system.stopActor(ref)`.

## E55

```text
Cannot select from remote actor '{address}': its snapshot is not synchronously readable because its state lives with another runtime. Read it on the runtime that owns it, or restore this snapshot with embedded children on the runtime that owns them.
```

Values: the address.

`select(...)` was called on a remote actor handle. Read the snapshot on the runtime that owns the actor.

## E56

```text
Remote actor '{address}' has no `trigger` shorthand: it requires a co-located actor. Use `send(...)`, which routes through the system runtime.
```

Values: the address.

`trigger` was used on a remote actor handle. Use `send(...)`.

## E57

```text
State key "{key}" contains "." — nest the states or escape it as "{escapedKey}".
```

Values: the state key.

A state key contains an unescaped `.`, which XState reads as a path delimiter. Nest the states, or escape the dot with a backslash (`'a\\.b'` in a JavaScript string literal).

## E58

```text
Duplicate state id '{id}': the states at '{path}' and '{otherPath}' both have it. State ids must be unique; rename the explicit `id`.
```

Values: the id.

Two states in one machine have the same id. Rename one of the explicit `id` values.

## E59

```text
No initial state specified for compound state node "#{stateId}". Try adding { initial: "{firstChildKey}" } to the state config.
```

Values: the state id.

A state with child states has no `initial`. Add `initial` with the key of the child to enter first.

## E60

```text
History state "{stateId}" must declare a non-empty `target`.
```

Values: the state id.

A history state has no default `target`. Add a `target` for the case where the parent has no recorded history.

## E61

```text
Choice state "{stateId}" must declare a `choice` function.
```

Values: the state id.

A state with `type: 'choice'` has no `choice` function. Add a `choice` function that returns a target.

## E62

```text
Choice state "{stateId}" must resolve to a target.
```

Values: the state id.

A choice state's `choice` function returned no target. Return a target on every path.

## E63

```text
Null events ("") cannot be specified as a transition key. Use `always: { ... }` instead.
```

Values: the state id.

A state's `on` has an empty-string key, which v4 used for eventless transitions. Move the transition to `always`.

## E64

```text
Initial state node "{target}" not found on parent state node #{stateId}
```

Values: the initial target, the parent state id.

A state's `initial` names a child that does not exist. Check the key against the state's children.

## E65

```text
Unable to send event to unknown child '{childId}'
Unable to send event to an undefined actor
```

Values: the target child id, or `undefined`.

This is the error attached to a dead letter, not a thrown error. `enq.sendTo(...)` targeted a child id that does not exist, or an undefined actor reference. The event is reported through `onRejectedEvent`. Check that the child is running when the event is sent.

## E66

```text
Actor source '{src}' is not provided
```

Values: the source key.

A spawn names an actor source that the machine does not provide. Register it in `setup({ actors })` or pass it to `machine.provide({ actors })`.

## E67

```text
Cannot spawn child actor with id '{childId}': the id is already in use by another child of '{actorId}'. Stop the existing child before reusing its id.
```

Values: the child id, the parent actor id.

A spawn or invoke uses a child id that another running child already has. Stop the existing child first, or use a different id.

## E68

```text
Only event objects may be used with raise; use raise({ type: "{event}" }) instead
```

Values: the event.

`enq.raise(...)` received a string. Pass an event object: `enq.raise({ type: '...' })`.

## E69

```text
Cannot terminate an active or stopped actor
```

Values: the actor id, the snapshot status.

Internal lifecycle error: termination was requested for an actor whose snapshot is not `done` or `error`. If custom actor logic triggers this, return a `done` or `error` snapshot before the actor terminates. Otherwise, report it as a bug.

## E70

```text
Only event objects may be used with sendTo; use sendTo({ type: "{event}" }) instead
```

Values: the event.

`enq.sendTo(...)` received a string event. Pass an event object: `enq.sendTo(target, { type: '...' })`.

## E71

```text
createMachine(config) takes one argument; the second argument (implementations) was removed. Declare implementations with setup({ actions, guards, actors, delays }).createMachine(config), or pass them to machine.provide({ ... }).
```

`createMachine(...)` received a second argument. Declare implementations with `setup({ actions, guards, actors, delays }).createMachine(config)`, or pass them to `machine.provide({ ... })`.

## E72

```text
Actor terminated before step "{key}" completed
```

Values: the step key.

The actor stopped or finished while a step was running or about to start. Keep the actor active until its steps complete, or handle the rejection.

## E73

```text
Internal event "{eventType}" cannot be sent to actor "{actorId}" from outside.
```

Values: the event type, the actor id.

An event declared in `schemas.internalEvents` was sent to the actor from outside. Internal events can only be raised or sent by the actor itself. Send a public event instead, or move the event out of `internalEvents`.

## E74

```text
Expected event {event} to have type matching "{type}"
Expected event {event} to have one of types matching "{types}"
```

Values: the event type, the expected types.

`assertEvent(event, type)` received an event of another type. Check which events reach the code that calls `assertEvent`, or add the type to the expected list.

## E75

```text
Timeout of {timeout} ms exceeded
```

Values: the timeout in milliseconds.

`waitFor(actor, predicate, { timeout })` timed out before the predicate returned `true`. Raise the timeout, or check that the actor reaches the expected snapshot.

## E76

```text
Actor terminated without satisfying predicate
```

The actor passed to `waitFor(...)` stopped or finished before the predicate returned `true`. Check the predicate against the actor's final snapshot.
