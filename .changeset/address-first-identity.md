---
'xstate': minor
---

Actors now have deterministic, location-transparent identity.

- Every actor has a logical `address`: the `/`-joined path of actor ids from the root. Root actors are named after their logic's `id`, and children spawned without an explicit id get deterministic per-parent counters keyed by their actor source (`worker:0`, `worker:1`). Addresses are stable across persistence and restore; `sessionId` identifies one incarnation of an address, and completions from a previous incarnation of a local child are dropped.
- `enq.sendTo('childId', event)` sends to a child by its string id, and `enq.spawn(actors.x)` records the registered source key so spawned children persist by key.
- `getEffectDescriptor(effect)` returns a serializable view of any executable effect, with actor references replaced by addresses and actor sources by source keys (payload fields pass through by reference).
- A host runtime can be installed as `system.runtime`; the built-in local runtime is the default. The new `deliverEvent`, `stopActor` and `terminateActor` helpers expose the local behaviors for custom runtimes to delegate to.
- `createDurable` (from `xstate/durable`) accepts `systemRuntime`, exposes `rootAddress` and `getActorRef(snapshot)`, tags every effect with a serializable `descriptor`, and `executeEffects` now resolves only when every transitively initiated runtime operation has been accepted — returning the events addressed to the root actor for the durable loop. Breaking for existing adapters: during `executeEffects`, root-addressed events no longer reach any runtime `sendEvent` (including per-effect `runtime()` implementations) — drain them from the `executeEffects` result instead. While the loop is parked in `waitForEvent`, a root-addressed event reaches `sendEvent` like any other target, and the host should enqueue it in its own mailbox. Runtime objects are also wrapped before effects see them, so identity comparisons and extra non-runtime properties on the returned object are not preserved.
- `getPersistedSnapshot(snapshot, { embedChildren: false })` persists children by logical address, leaving each child's state with the runtime that owns it; restoring an address-only child produces a location-transparent handle whose sends route through the system runtime.

```ts
const durable = createDurable(machine, {
  executeAction: (action, { id }, runtime) =>
    host.runAction(id, () => action.exec(runtime)),
  systemRuntime: {
    sendEvent: (source, target, event) =>
      host.send(source?.address, target.address, event)
  },
  waitForEvent: ({ id }) => host.waitForEvent(id)
});
```
