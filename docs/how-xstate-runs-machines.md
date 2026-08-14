---
title: How XState runs your machine
description: What happens between sending an event and observing the next snapshot.
---

Understanding the order of operations makes machines predictable to write, test, and persist. This page explains what happens when an actor receives an event.

## Transitions are pure

When an event arrives, XState calls the matching transition function. The function computes what should change and returns it. Nothing else happens while it runs.

```ts
on: {
  submit: ({ context }, enq) => {
    enq(() => analytics.track('submitted'));
    return { target: 'submitting', context: { ...context, attempts: context.attempts + 1 } };
  }
}
```

The `enq` calls do not run effects. They record them. The analytics call above has not happened when the function returns. It has been added to a queue. This is why a transition function must not rely on an effect's result: the result does not exist yet.

Because transitions are pure, XState can calculate the next snapshot without an actor. [`transition(...)`](utilities.md) does this, so a test can compute a next snapshot directly. Restoring a [persisted snapshot](persistence.md) does not replay effects either.

## One event, one snapshot

Processing one event can involve several internal steps: the event's own transition, then any [`always`](transitions.md) transitions or [choice states](choice-states.md) the new state triggers, repeated until the machine settles. These internal steps are called microsteps. Observers never see them individually.

```text
event received
  → transition function runs (pure, effects queued)
  → always / choice resolution runs until stable
  → one new snapshot is produced
  → queued effects execute, in order
  → subscribers are notified
```

An actor's subscribers receive one snapshot per processed event, not one per microstep. If a `submit` event lands on a state whose `always` immediately forwards to another state, subscribers see only the final state.

## When effects run

Queued effects execute after the next snapshot is resolved, in the order they were enqueued. By the time an effect runs:

- `actor.getSnapshot()` already returns the new snapshot
- spawned and invoked child actors for the new state exist
- the effect still runs even if the state it was queued in has already been exited

Events raised with `enq.raise(...)` are processed before the actor handles the next external event. Events emitted with `enq.emit(...)` reach [`actor.on(...)`](emitted-events.md) handlers after the transition is applied, so a handler that reads the snapshot sees the state the transition produced.

## Which transition runs

When an event arrives, the deepest active state gets the first chance to handle it. If it has no matching transition, the event bubbles up through its ancestors. A child can define an event as `undefined` to block a parent's transition. Wildcards such as `pointer.*` and `*` only match when no exact transition matches at that state.

In a [parallel state](parallel-states.md), every active region receives the event, so one event can move several regions at once.

An event with no matching transition anywhere is ignored: no state change and no effects. Subscribers are still notified once, with the same snapshot object as before, so a reference check is enough to skip re-rendering.

## Why this design

- **Determinism.** Given a snapshot and an event, the next snapshot is always the same. Tests can assert on it directly.
- **Cancellation and cleanup.** Because invoked actors belong to states and effects are explicit, leaving a state reliably stops its work.
- **Persistence.** A snapshot is data. Restoring it does not re-run entry effects from history, and [durable steps](actor-logic.md) let async work resume without repeating what already happened.
- **Inspection.** Every processed event produces one [inspection event](inspection.md) carrying the event, the snapshot, and the microsteps.

## What next?

- [Transitions](transitions.md) for the full transition reference.
- [Actions](actions.md) for everything `enq` can queue.
- [Testing](testing.md) for asserting on snapshots and pure transition results.
