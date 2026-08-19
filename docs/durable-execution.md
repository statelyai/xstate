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
  systemRuntime: {
    sendEvent: (source, target, event) =>
      host.send(source?.address, target.address, event),
    scheduleTimer: (source, id, delay) =>
      host.schedule({ address: source.address, timerId: id, delay }),
    cancelTimer: (source, id) =>
      host.cancelTimer({ address: source.address, timerId: id })
  },
  waitForEvent: ({ id }) => host.waitForEvent(id)
});

const output = await durable.run(input);
```

`run()` is convenience over the explicit transition loop:

```ts
let [state, effects] = durable.initialTransition(input);
let rootEvents = await durable.executeEffects(effects);

while (state.status === 'active') {
  const event =
    rootEvents.shift()?.event ?? (await durable.waitForEvent());
  [state, effects] = durable.transition(state, event);
  rootEvents.push(...(await durable.executeEffects(effects)));
}
```

`initialTransition()` and `transition()` remain pure. The helper tags their
ordered effects with stable IDs such as `0:0` and `1:0`, and event waits with
IDs such as `event:0`. A durable host should memoize or deduplicate each
operation using that ID. Replaying the same events from the beginning
reconstructs the same snapshots, effects, waits and IDs.

## Addresses

Every actor has a deterministic logical `address`: the `/`-joined path of
actor ids from the root. The root actor's address is the machine's `id`
(`durable.rootAddress` reports it before any transition runs), and generated
child ids are per-parent counters keyed by their actor source, such as
`order/worker:0`. `/` is reserved as the path delimiter and must not appear
in actor or machine ids. Addresses are stable across persistence and
restore; a restored remote handle keeps its persisted address verbatim — the
owning runtime's identity for the child — even when the local parent chain
differs.

`sessionId` identifies one incarnation of an address. A restored actor is a
new incarnation: completion events carry the producing incarnation's
`sessionId`, and `transition()` drops completions from a previous incarnation
of a local child.

Use addresses, not object identity, wherever the host correlates actors
across transitions. Actor references passed to runtime operations expose
`address`, `id` and (for registered sources) a string `src` key, and
`JSON.stringify` on a reference produces that identity. To place several
executions of the same machine on one transport, namespace the wire address
with a host key outside the logical address.

## The system runtime

`systemRuntime` is installed on the actor system of every snapshot the
execution produces. XState calculates transitions; the runtime executes their
effects — the local in-memory runtime that `createActor(machine).start()` uses
is one runtime at the same level as any other. Operations initiated by live
child actors (parent sends, timers, terminations) route through the installed
runtime with no per-actor wiring. Omitted operations keep their local
behavior; the `deliverEvent`, `stopActor` and `terminateActor` helpers
exported from `xstate` expose those local behaviors for a runtime's own
implementations to delegate to.

Every inter-actor edge is an asynchronous handoff to the runtime.
`executeEffects` queues top-level operations sequentially in initiation order
and resolves only when every transitively initiated operation has been
accepted (a failed operation rejects it), so "effects executed" means "safe
to checkpoint and suspend". An operation initiated while another is in
flight — typically from within that operation — executes immediately instead
of queueing behind it.

During `executeEffects`, events addressed to the root actor do not reach
`sendEvent`. The execution captures them and resolves them from that call as
`{ event, source }` records; process them through `transition()` before
durably waiting, as the explicit loop above does.

The capture is scoped to that call. While the loop is parked, a root-addressed
event — a live child replying to its parent after the host delivered an event
to it, for example — reaches the runtime's `sendEvent` like an event for any
other target, and belongs in the host's own mailbox. A `systemRuntime` that
implements `sendEvent` must therefore handle a target whose address is
`durable.rootAddress` by enqueueing the event for the loop's next
`transition()`. For the same reason, operations initiated while the loop is
parked are not tracked by the execution: the host awaits its own delivery
chains, and a failure there is not reported through a later `executeEffects`.

Each `DurableEffect` also carries a serializable `descriptor` — the effect
with actor references replaced by addresses and actor sources by source keys
— for journaling and deduplication. Payload fields such as `event` and
`input` pass through by reference and are only as serializable as their
values.

A runtime operation implementation must not await another runtime operation
of the same execution through the actor system; operations initiated while
one is running execute inline rather than queueing, and the `deliverEvent`,
`stopActor` and `terminateActor` helpers are always safe to call directly.

A per-effect `runtime(metadata, effect)` factory remains available for hosts
that key operations by effect ID; it overrides the system runtime
operation-by-operation, and operations it omits keep the system runtime's
behavior. With neither `systemRuntime` nor a per-effect runtime, unsupported
runtime operations throw instead of silently running local behavior on a
durable host.

## Checkpoints

`getPersistedSnapshot(snapshot)` embeds each child's persisted state: the
whole-tree checkpoint of a runtime that co-locates the tree.
`getPersistedSnapshot(snapshot, { embedChildren: false })` instead references
children by logical address, leaving each child's state — including its own
subtree — with the runtime that owns it; the option applies to the whole
tree, not per placement boundary. Restoring an address-only child produces a location-transparent
handle: sends route through the system runtime, its snapshot exposes
lifecycle only (a full snapshot is the last value an actor published, which
only co-located actors observe), and completion staleness for it is the
owning runtime's responsibility.

Hosts that restore from checkpoints instead of replaying from the beginning
should persist `durable.nextTransitionIndex` after every transition,
including transitions with no effects, and pass it as `transitionIndex` when
recreating the durable execution. `durable.getActorRef(snapshot)` returns the
root actor reference behind a snapshot this execution produced, for
addressing and inspection.

`run()` resolves with the machine output when the machine is done, throws the
machine error when it fails, and throws `DurableExecutionCancelledError` when
it stops. It only starts fresh executions. A nonzero `transitionIndex`, or
calling a lower-level transition method before `run()`, causes
`DurableExecutionResumeError`; resume with the persisted snapshot and the
explicit transition loop instead.

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
