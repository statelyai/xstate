---
'xstate': minor
---

Actors now have deterministic, location-transparent identity.

- Every actor has a logical `address`: the `/`-joined path of actor ids from the root. Root actors are named after their logic's `id`, and children spawned without an explicit id get deterministic per-parent counters keyed by their actor source (`worker:0`, `worker:1`). Addresses are stable across persistence and restore; `sessionId` identifies one incarnation of an address, and completions from a previous incarnation of a local child are dropped.
- `enq.spawn(actors.x)` records the registered source key so spawned children persist by key.
- `getEffectDescriptor(effect)` returns a serializable view of any executable effect, with actor references replaced by addresses and actor sources by source keys (payload fields pass through by reference).
- A host runtime can be installed as `system.runtime`; the built-in local runtime is the default. The new `deliverEvent`, `stopActor` and `terminateActor` helpers expose the local behaviors for custom runtimes to delegate to.
- `createDurable` (from `xstate/durable`) adapters carry their runtime operations directly (`sendEvent`, `scheduleTimer`, …), and the execution installs them on every snapshot's actor system; it exposes `rootAddress` and `getActorRef(snapshot)`, tags every effect with a serializable `descriptor`, and `executeEffects` resolves only when every transitively initiated runtime operation has been accepted — returning the events addressed to the root actor for the durable loop. Breaking for existing adapters: during `executeEffects`, root-addressed events no longer reach any runtime `sendEvent` (including per-effect `runtime()` implementations) — drain them from the `executeEffects` result instead. While the loop is parked in `waitForEvent`, a root-addressed event reaches `sendEvent` like any other target, and the host should enqueue it in its own mailbox. Runtime objects are also wrapped before effects see them, so identity comparisons and extra non-runtime properties on the returned object are not preserved.
- `getPersistedSnapshot(snapshot, { embedChildren: false })` persists children by logical address, leaving each child's state with the runtime that owns it; restoring an address-only child produces a location-transparent handle whose sends route through the system runtime.
- Explicit child ids are unique per parent: spawning or invoking with an id already held by a live sibling throws (ids stopped earlier in the same transition stay reusable). Previously a duplicate id silently created a second running actor at the same address. A transition to a history state that restores its own source now exits and reenters the source, so its invoked actors restart instead of leaking.
- Undeliverable events are reported through the new `deadLetter` runtime operation and a `@xstate.deadletter` inspection event. Delivery stays at-most-once — this is observability, not retry.
- A persisted remote child entry round-trips an optional opaque `incarnation` token. XState never stamps one, but when a host does, completions from a different incarnation of the address are dropped and `sendTo` effect descriptors journal the target's token.
- `createDurable` exposes `machineId` and `machineVersion` so hosts can pin an execution's journal to the machine version that produced it.
- Async-actor steps (`enq.step`) route through the new `runStep` runtime operation. The built-in behavior memoizes results in the actor's own snapshot as before; a durable host implements `runStep` to own the step journal, replaying memoized results without re-running the step. The `runStep` helper export exposes the built-in behavior.
- Serialized actor references (`Actor.toJSON`, persisted context refs) carry `xstate$type: 'actorRef'` instead of the v5 `xstate$$type: 1` marker. Migrate v5-persisted context refs with `machineVersions` if you restore them.
- Timers persisted from a running actor carry their wall-clock start (`startedAt`); restoring the snapshot schedules the remaining time toward the original deadline (clamped to the declared delay), so a timer past due fires immediately instead of restarting its full delay. Pure-transition snapshots carry no timestamp and restart the declared delay.

```ts
const durable = createDurable(machine, {
  sendEvent: (source, target, event) =>
    host.send(source?.address, target.address, event),
  executeAction: (action, { id }, runtime) =>
    host.runAction(id, () => action.exec(runtime)),
  waitForEvent: ({ id }) => host.waitForEvent(id)
});
```
