---
"xstate": minor
---

Durable executions preserve timer deadlines in checkpoints persisted after `executeEffects()` succeeds. Adapters can provide an absolute `now()` clock shared across restores and replay. Root error snapshots no longer also trigger an unhandled global throw; explicit hosts handle the snapshot, while `run()` rejects with its error.

`createMachineFromConfig()` retains named actor sources so `.provide({ actors })` can replace them, including when restoring children.

Actor logic exposes optional `completion` metadata: `'never'` for persistent callback/listener/subscription and FSM logic; `'possible'` when completion is supported. It describes capability, not a guarantee that a run will finish. Custom `createLogic()` may declare `completion: 'never'`.

Reserved `xstate.*` transition descriptors are accepted without losing exact declared event payload types. Machines created from `never` configs no longer trigger excessive type instantiation in generic consumers.

```ts
await execution.executeEffects(effects);
const checkpoint = machine.getPersistedSnapshot(snapshot);

// Exclude persistent listeners according to the host's pending-work policy.
const canComplete = childLogic.completion !== 'never';
```
