---
title: Durable execution
description: Plan pure XState transitions for a durable host.
---

Import `createDurableSystem` from `xstate/durable` when a workflow platform owns
persistence, retries, timers, messaging, and child execution.

```ts
import { createDurableSystem } from 'xstate/durable';

const durable = createDurableSystem(machine);
let { state, effects } = durable.initialTransition(input);

await durable.executeEffects(effects, {
  execute: (effect, executeAction) =>
    host.step(effect.id, async () => {
      if (executeAction) return executeAction();
      await host.execute(effect);
    })
});

const persisted = durable.getPersistedSystemSnapshot(state);
```

`initialTransition()` and `transition()` are pure. They return a state and an
ordered plan. Every effect has a stable ID such as `0:0`. Replaying the same
event from the same state produces the same snapshot, actor identities, and
effects.

The planner coordinates the complete actor tree. Deliver an event to a child
without constructing a separate runtime or rewriting its identity:

```ts
const result = durable.transitionActor(state, workerRef, {
  type: 'PROCESS'
});
```

Child initialization effects are included after that child's `actor.start`
effect. A local interpreter and a distributed host can therefore consume the
same system plan; they differ only in how effects, inboxes, and timers are
executed.

## Logical actor references

Durable effects contain `DurableActorRef` data, never live actor instances:

```ts
type DurableActorRef = {
  id: string; // incarnation, for example "notifier:5"
  actorId: string; // readable parent-local ID, for example "notifier"
};
```

A spawn reserves the next logical incarnation in the system snapshot. A stop
followed by another spawn of the same `actorId` receives a new `id`. Sends,
timers, starts, stops, and completion events all use that logical ID. This lets
the host persist routing without reading `_parent`, `_send`, `_terminate`, or
other actor internals.

Snapshots produced by the durable planner contain inert child handles whose
`sessionId` is the logical incarnation. They support identity, persistence, and
effect planning, but cannot be started, subscribed to, or sent events directly.
Use the returned effect plan for those operations. No live `Actor` or
`ActorSystemRuntime` is created while planning.

Only registered string actor sources can be spawned durably. The normalized
`actor.spawn` effect contains the source key and input; it never contains an
actor logic object.

## Persistence

Use the system snapshot whenever the execution contains child actors:

```ts
const persisted = JSON.parse(
  JSON.stringify(durable.getPersistedSystemSnapshot(state))
);
state = durable.restoreSystemSnapshot(persisted);
```

It contains the persisted root machine snapshot, logical actor topology, the
next actor incarnation counter, and the next transition index. Checkpoint the
returned state and its effects atomically before executing the effects.

For a single state machine with no durable children, machine-only persistence
remains available:

```ts
const snapshot = durable.getPersistedSnapshot(state);
state = durable.restoreSnapshot(snapshot, {
  transitionIndex: state.nextTransitionIndex
});
```

The transition index must still be checkpointed so effect IDs do not reset.
Machine-only restoration rejects snapshots with children because it cannot
preserve their logical generations.

## Stale completion events

Child lifecycle events sent by the host carry their logical incarnation in
`sessionId`:

```ts
const result = durable.transition(state, {
  type: 'xstate.done.actor',
  actorId: 'notifier',
  sessionId: 'notifier:5',
  output
});

if (!result.accepted) {
  // The child was stopped or replaced. Acknowledge the stale message.
}
```

XState compares this ID directly with the child's logical `sessionId`. It
returns `{ accepted: false, effects: [] }` for an old or unknown generation. The
state object is unchanged.

## Host contract

Normalized effects cover actions, spawn/start/stop/termination, sends, emits,
and timer schedule/cancel operations. Timer schedules include their logical
source, target, event, ID, and relative delay. The host stamps an absolute
deadline when it commits the effect.

`executeEffects()` awaits host operations in order. The host remains responsible
for:

- atomically storing the checkpoint and outbox;
- deduplicating effects by `effect.id`;
- durable inboxes and deterministic local delivery queues;
- retries, absolute timer deadlines, and cancellation storage;
- running registered actor sources and publishing their lifecycle events;
- durable inspection storage and transport.

`ActorSystemRuntime` is the low-level runtime used by XState's local
interpreter. It receives live actors and is not the durable/distributed host
protocol. Existing `createDurable()` adapters that override it remain available
for compatibility, but new durable hosts should consume `createDurableSystem()`
plans.

## What next?

- [Run backend workflows](backend-workflows.md) when your application restores a
  local actor per request.
- [Persistence](persistence.md) for snapshot versioning, migration, and event
  adaptation.
