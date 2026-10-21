---
"xstate": minor
---

Durable executions preserve timer deadlines in checkpoints persisted after `executeEffects()` succeeds. Adapters can provide an absolute `now()` clock shared across restores and replay. Root error snapshots no longer also trigger an unhandled global throw; explicit hosts handle the snapshot, while `run()` rejects with its error.

`createMachineFromConfig()` retains named actor sources so `.provide({ actors })` can replace them, including when restoring children.

Reserved `xstate.*` transition descriptors are accepted without losing exact declared event payload types. Machines created from `never` configs no longer trigger excessive type instantiation in generic consumers.

```ts
await execution.executeEffects(effects);
const checkpoint = machine.getPersistedSnapshot(snapshot);
```
