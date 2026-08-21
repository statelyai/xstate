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
    // Safe only when the action body performs plain external side effects.
    // See "Journaling rules" before journaling `exec` on engines whose
    // journaled step must not start another journaled operation.
    host.runAction(id, () => action.exec(runtime)),
  waitForEvent: ({ id }) => host.waitForEvent(id)
});

const output = await durable.run(input);
```

Runtime operations you omit keep their local behavior — spawned machine
children run in this process, for example.

The primary durable unit for async work is the actor itself: a developer
writes a normal promise (`fromPromise`, `createAsyncLogic`) and invokes it;
the `runLogic` operation hands the host the whole body as one journal
entry. The actor's identity — `address`, string `src` key and serializable
`input` — crosses any boundary, so a host either wraps the provided `exec`
in its own step primitive, or ignores it entirely and re-runs the
registered logic on a remote executor from `(src, input)` alone; the output
flows back as the actor's ordinary completion event. No step vocabulary
appears in the machine.

```ts
runLogic: (actor, exec) => ctx.run(actor.address, exec)          // in-process journal
runLogic: (actor) => activities.runLogic(actor.src, actor.getSnapshot().input) // remote executor
```

Custom actions follow the same rule — durability crosses a boundary as
declared identity plus serializable data, never as a closure. An action
enqueued as a named function with serializable arguments
(`enq(notifyApprover, context.orderId)`) carries `(type, args)` in its
descriptor, so a remote-executor host can dispatch it worker-side and ignore
`exec`, exactly like `runLogic`. An action enqueued as an inline closure
(`enq(() => …)`) has no portable identity: it runs in this process, journaled
by its effect ID. Work heavy enough to deserve an activity is usually an
actor, not an action.

For finer granularity — several independently-journaled awaits — split into
separate invoked actors: each actor is its own journal entry, and the states
between them make the progress visible. Do not reach for `enq.step` on a
durable host; it is the [hostless durability](actor-logic.md) tool — the
snapshot is its journal — and on a durable host it only duplicates what
`runLogic` already provides. When restored snapshots that carry step results
do run under a durable host, `enq.step` routes through the `runStep`
operation:
implement it to journal steps in the host's journal — a memoized result
replays without re-running the step — and the built-in
snapshot memoization steps aside. Unlike other operations, a step is an
orchestration frame that may itself await runtime operations of the same
execution, so it is never serialized behind them — and for the same reason
`executeEffects` resolves without awaiting it. The `runStep` helper exported
from `xstate` exposes the built-in behavior. `exec` is a closure over live
execution state: run it in this process and journal its result; it cannot be
shipped to a remote executor.

Because logic bodies and steps outlive `executeEffects`, a host whose wait
is durable rather than in-process must account for them before parking:
either race its durable wait against the pending `runLogic`/`runStep`
promises it created (the natural shape when they map to the engine's own
step primitives), or drain them to empty first. An in-flight step ends by
completing its actor, and that completion event cannot satisfy a durable
wait that was already registered with the engine — the run deadlocks until
its idle timeout. The in-process loop above needs none of this, because any
later event resolves its wait. Operations initiated by live child
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
replaying from the beginning. Persist `durable.machineId` and
`durable.machineVersion` with the execution and reject a worker whose values
differ: a changed machine reorders effect ids, and memoized results silently
misalign.

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
of a local child. Session ids embed a random per-process system id, so a
host that journals the execution's own events (rather than only external
ones) must pin `executionId` on the adapter: session ids become
`<executionId>:<n>`, a deterministic function of actor-creation order, and a
replayed execution re-creates the same ids — a journaled completion still
matches the child the replay re-creates. Uniqueness across executions is the
host's responsibility. For a remote child the owning runtime is the authority on
staleness by default; a host that stores an opaque `incarnation` token on
the persisted child entry gets the same guard on the referencing side. The
token is the owner's `sessionId` for the child and the restored handle
carries it as its own `sessionId` — one incarnation identity, one rule: a
ref that knows its incarnation compares it, one that does not defers to the
owner. `sendTo` effect descriptors journal the target's token so a send
replayed after the address was reincarnated is detectable.

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
effects, waits and IDs — not just the same resulting snapshot, but the same
effects in the same order, which is what hosts that match journal entries
positionally (Temporal, Restate) depend on. Each `DurableEffect` also carries a serializable
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
This matches the Erlang and Akka defaults. A dropped event is reported
through the `deadLetter` runtime operation (and a `@xstate.deadletter`
inspection event) — observability, not retry. Ordering is not transitive
across intermediaries. The durable path is stronger — the handoff queue serializes
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

### Journaling rules

A journaled step's closure must contain only the external side effect —
nothing that re-enters the engine's journal, and nothing that mutates local
actors.

- **Journaled operations must not nest.** On engines whose journaled step
  cannot start another journaled operation (Restate's `ctx.run`, a Temporal
  activity), an action body that uses its `runtime` argument from inside a
  journaled closure fails or retries the invocation indefinitely. Journal
  `action.exec(runtime)` only when the body is a plain external side effect;
  otherwise run `exec` outside the journal and journal the host-native calls
  the runtime operations make.
- **Local actor mutations stay outside the journal.** A journaled closure is
  skipped on replay: calling `deliverEvent`, `stopActor`, or starting an
  actor inside one rebuilds a different actor tree than the recorded run —
  silently, with no error. Re-run local mutations unjournaled on every
  replay; journal only work that must not run twice.

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

## Driving effects yourself

`createDurable` is sugar over the pure APIs: its `initialTransition` and
`transition` call the exported `initialTransition(logic, input)` and
`transition(logic, snapshot, event)` directly, adding only stable-ID tags on
the effects and the runtime installation. `createActor` is the built-in
in-process runtime over the same pure relations; `createDurable` is the
journaled one.

Effects are plain objects — each has a serializable `descriptor` and an
`exec(runtime)` method — so a host may take `[snapshot, effects]` from the
pure APIs and execute them entirely its own way. Dropping `executeEffects`
means providing its four services yourself: transitive settlement (an
effect's operations trigger further operations; "executed" must mean the
whole cascade was accepted before checkpointing), root-event capture
(children's sends to the root must surface instead of queuing on an inert
mailbox), ordered handoff to the runtime, and batch failure discard for
retries. Engines with native equivalents for some of these may prefer their
own; everyone else should stay on `executeEffects`.

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
