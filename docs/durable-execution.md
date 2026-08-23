---
title: Durable execution
description: Run pure XState transitions on a durable host.
---

Import the experimental durable execution helper from `xstate/durable` when a
workflow platform owns persistence, retries, timers, messaging and child
execution.

This is for hosts that durably replay or checkpoint the execution loop. If your
application instead restores an actor for each request, processes one event and
saves its snapshot, use the [backend workflow](backend-workflows.md) pattern.

```ts
import { createDurable } from 'xstate/durable';

const durable = createDurable(machine, {
  executeAction: (action, { id }, runtime) =>
    host.runAction(id, () => action.exec(runtime)),
  runtime: ({ id: effectId }, effect) => ({
    sendEvent: (_source, target, event) =>
      host.send(effectId, target.id, event),
    scheduleTimer: (source, id, delay) =>
      host.schedule({ effectId, actorId: source.id, timerId: id, delay }),
    cancelTimer: (source, id) =>
      host.cancelTimer({ effectId, actorId: source.id, timerId: id })
    // Map the remaining ActorSystemRuntime operations supported by the host.
  }),
  waitForEvent: ({ id }) => host.waitForEvent(id)
});

const output = await durable.run(input);
```

`run()` is convenience over the explicit transition loop:

```ts
let [state, effects] = durable.initialTransition(input);
await durable.executeEffects(effects);

while (state.status === 'active') {
  const event = await durable.waitForEvent();
  [state, effects] = durable.transition(state, event);
  await durable.executeEffects(effects);
}
```

`initialTransition()` and `transition()` remain pure. The helper tags their
ordered effects with stable IDs such as `0:0` and `1:0`, and event waits with
IDs such as `event:0`. A durable host should memoize or deduplicate each
operation using that ID. Replaying the same events from the beginning
reconstructs the same snapshots, effects, waits and IDs.

The host runtime subsumes the local actor system. XState calculates transitions
and stable operation IDs; the adapter maps those operations to durable host
primitives:

- Actions run through `executeAction()` with their stable effect ID and the
  runtime returned by `runtime()`. External work should use the effect ID as an
  idempotency key. A host may require actions to have registered `type` values
  when its activity model cannot replay inline code.
- Sends route through the host's actor or workflow identity.
- Timers register host-managed delivery and return immediately. The host stamps
  `dueAt` when it durably commits the timer; transition calculation never reads
  wall-clock time.
- Invoked or spawned actors use host child-workflow facilities when available.
- Unsupported runtime operations throw.

Custom actions are dispatched separately from actor-system effects. This keeps
host operations such as timers and child workflows visible to runtimes that do
not permit durable operations to be nested inside a generic activity. Both
callbacks receive the complete effect metadata. `runtime()` creates the host
runtime and receives the complete effect; `executeAction()` receives that
runtime when it executes the action.

## Rejected events

When the machine declares a runtime validator, an external event whose payload
fails its schema is rejected at the boundary: `transition()` returns the
snapshot unchanged together with a `@xstate.rejectEvent` effect, and never
throws. Replay stays total — replaying a poisoned queued event produces the
same unchanged snapshot and the same rejection effect every time.

`executeEffects()` routes rejection effects to the optional `onRejectedEvent`
adapter hook instead of executing them, so the host can journal the dead letter
and continue:

```ts
const durable = createDurable(machine, {
  // ...
  onRejectedEvent: (rejection, { id }) =>
    host.journalDeadLetter(id, rejection.event, rejection.issues)
});
```

Events the machine raises to itself are not boundary events. A delayed raised
event that fails its schema throws from `transition()` and errors the
execution; that is a machine bug.

`run()` resolves with the machine output when the machine is done, throws the
machine error when it fails, and throws `DurableExecutionCancelledError` when
it stops. It only starts fresh executions. A nonzero `transitionIndex`, or
calling a lower-level transition method before `run()`, causes
`DurableExecutionResumeError`; resume with the persisted snapshot and the
explicit transition loop instead.

The helper does not prescribe storage, inboxes, retries or timer
implementations. Hosts that restore from checkpoints instead of replaying from
the beginning should persist `durable.nextTransitionIndex` after every
transition, including transitions with no effects, and pass it as
`transitionIndex` when recreating the durable execution.

## Host adapters

XState does not ship adapters for specific workflow platforms. `createDurable`
defines the contract; writing the adapter for a given host is your
responsibility.

A full integration needs host-native mappings for timers, messaging and child
actors. Approximations break subtle semantics. For example, awaiting a sleep
inline cannot implement a cancelable timer while also receiving intervening
events.

## What next?

- [Run backend workflows](backend-workflows.md) when your application owns
  snapshot storage and restores an actor per request.
- [Persistence](persistence.md) for snapshot versioning, migration and event
  adaptation.
