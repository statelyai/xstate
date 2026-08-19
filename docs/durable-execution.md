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

## Write an adapter

An adapter is the runtime operations that execute effects, plus two durable
loop hooks: `executeAction` runs a custom action as a host step, and
`waitForEvent` durably waits for the next event.

```ts
import { createDurable } from 'xstate/durable';

const durable = createDurable(machine, {
  sendEvent: (source, target, event) =>
    host.send(source?.address, target.address, event),
  scheduleTimer: (source, id, delay) =>
    host.schedule({ address: source.address, timerId: id, delay }),
  cancelTimer: (source, id) =>
    host.cancelTimer({ address: source.address, timerId: id }),
  executeAction: (action, { id }, runtime) =>
    host.runAction(id, () => action.exec(runtime)),
  waitForEvent: ({ id }) => host.waitForEvent(id)
});

const output = await durable.run(input);
```

Runtime operations you omit keep their local behavior — spawned machine
children run in this process, for example. Operations initiated by live child
actors (parent sends, timers, terminations) route to your implementations
with no per-actor wiring. `run()` is convenience over the explicit loop:

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

Checkpoint with `getPersistedSnapshot(state)` after `executeEffects`
resolves, and persist `durable.nextTransitionIndex` alongside; pass it as
`transitionIndex` when recreating the execution from a checkpoint instead of
replaying from the beginning.

That is the whole integration. The rest of this page specifies the contract
precisely.

## Identity

Every actor has a deterministic logical `address`: the `/`-joined path of
actor ids from the root. The root actor's address is the machine's `id`
(`durable.rootAddress` reports it before any transition runs), and generated
child ids are per-parent counters keyed by their actor source, such as
`order/worker:0`. `/` separates segments, so an id containing one is
percent-encoded (`%2F`) in the address and the path stays unambiguous.
Addresses are stable across persistence and restore.

`sessionId` identifies one incarnation of an address. A restored actor is a
new incarnation: completion events carry the producing incarnation's
`sessionId`, and `transition()` drops completions from a previous incarnation
of a local child.

Correlate actors by address, not object identity. Actor references passed to
runtime operations expose `address`, `id` and (for registered sources) a
string `src` key, and `JSON.stringify` on a reference produces that identity.
To place several executions of the same machine on one transport, namespace
the wire address with a host key outside the logical address.

## The effect contract

`initialTransition()` and `transition()` remain pure. The helper tags their
ordered effects with stable IDs such as `0:0` and `1:0`, and event waits with
IDs such as `event:0`. Memoize or deduplicate each operation using that ID:
replaying the same events from the beginning reconstructs the same snapshots,
effects, waits and IDs. Each `DurableEffect` also carries a serializable
`descriptor` — actor references replaced by addresses and actor sources by
source keys — for journaling; payload fields such as `event` and `input` pass
through by reference and are only as serializable as their values.

Every inter-actor edge is an asynchronous handoff to the runtime.
`executeEffects` hands operations over one at a time, in initiation order,
and resolves only when every transitively initiated operation has been
accepted (a failed operation rejects it, and a failed call discards its
batch), so "effects executed" means "safe to checkpoint and suspend". Hosts
whose step or activity model forbids concurrent entries can rely on that
ordering, including for the operations a stop cascade initiates. Calls to
`executeEffects` themselves must not overlap; starting a new batch before the
previous call settles throws. A rejected batch may be retried, but retries
re-run every operation in it — including local delivery to co-located
children — so a retried batch can re-deliver events the first attempt already
delivered. Hosts that retry need idempotent operations, keyed by the effect
ID.

Delivery is at-most-once with pairwise sender-to-receiver ordering: for a
given pair of actors, events sent from the first to the second are enqueued
in send order, and an undeliverable event is dropped rather than retried.
This matches the Erlang and Akka defaults. Ordering is not transitive across
intermediaries. The durable path is stronger — the handoff queue serializes
every operation of an execution globally. A host `sendEvent` that routes
remotely is responsible for preserving pairwise ordering on its transport.

Because every handoff queues, a runtime operation must never await another
runtime operation of the same execution through the actor system — it would
wait behind itself. The `deliverEvent`, `stopActor` and `terminateActor`
helpers exported from `xstate` expose the local behaviors and are always safe
to call directly. An implemented runtime operation replaces the local
behavior entirely, including its bookkeeping — a `stopActor` that only journals
must call the `stopActor` helper for the local stop cascade, and a `sendEvent`
that routes locally must call `deliverEvent`. When a remote runtime can
deliver the same completion more than once (retries, replays), the host is
responsible for deduplicating before handing it to the execution.

Events addressed to the root actor do not reach `sendEvent` during
`executeEffects`: the execution captures them and resolves them from that
call as `{ event, source }` records for the loop to process before
suspending. While the loop is parked in `waitForEvent()`, a root-addressed
event reaches `sendEvent` like any other target and belongs in the host's
mailbox; if the adapter implements no `sendEvent`, producing one there throws,
since delivering it locally to the inert root would silently lose it.

A per-effect `runtime(metadata, effect)` factory is available for hosts that
key operations by effect ID; it overrides the adapter's runtime operations
operation-by-operation. With no runtime operations at all, unsupported
operations throw instead of silently running local behavior on a durable
host.

## Determinism constraints

Replay only reconstructs the same effects when every transition is a pure
function of the snapshot and event. Code that runs during a transition — 
guards, transition functions, `context` assigners, `input` factories — must
not read the clock, generate random values, or reach external state:
`Date.now()`, `Math.random()`, and `crypto.randomUUID()` all produce a
different effect sequence on replay, and nothing detects the divergence.
Perform such work inside journaled operations (the host's `executeAction`,
where the recorded result replays), or derive values deterministically from
what the snapshot already carries — addresses and effect IDs are stable
across replays and make good seeds and idempotency keys.

## Checkpoints and placement

`getPersistedSnapshot(snapshot)` embeds each child's persisted state: the
whole-tree checkpoint of a runtime that co-locates the tree.
`getPersistedSnapshot(snapshot, { embedChildren: false })` instead references
children by logical address, leaving each child's state — including its own
subtree — with the runtime that owns it; the option applies to the whole
tree, not per placement boundary. Restoring an address-only child produces a
location-transparent handle: sends route through the system runtime, its
snapshot exposes lifecycle only (a full snapshot is the last value an actor
published, which only co-located actors observe), `subscribe` and `on` are
inert (observation is co-location), and completion staleness for it is the
owning runtime's responsibility. Persisting a handle from the referencing
side throws — its state lives with the runtime that owns it. A restored handle keeps its
persisted address verbatim — the owning runtime's identity for the child.

`durable.getActorRef(snapshot)` returns the root actor reference behind a
snapshot this execution produced, for addressing and inspection.

`run()` resolves with the machine output when the machine is done, throws the
machine error when it fails, and throws `DurableExecutionCancelledError` when
it stops. It only starts fresh executions. A nonzero `transitionIndex`, or
calling a lower-level transition method before `run()`, causes
`DurableExecutionResumeError`; resume with the persisted snapshot and the
explicit transition loop instead.

## Host adapters

XState does not ship adapters for specific workflow platforms. `createDurable`
defines the contract; writing the adapter for a given host is your
responsibility. A full integration needs host-native mappings for timers,
messaging and child actors. Approximations break subtle semantics: for
example, awaiting a sleep inline cannot implement a cancelable timer while
also receiving intervening events.

## What next?

- [Run backend workflows](backend-workflows.md) when your application owns
  snapshot storage and restores an actor per request.
- [Persistence](persistence.md) for snapshot versioning, migration and event
  adaptation.
