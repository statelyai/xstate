---
'xstate': minor
---

Add experimental `execution.restore(persistedSnapshot)` to `xstate/durable` for
resuming checkpoints without sending a synthetic event or replaying entry
actions. Execute the returned effects to resume active embedded children and
pending timers. Restored child startup uses the host adapter, including nested
children. Timers with a persisted wall-clock start keep their original deadline,
including time spent waiting to execute effects or starting children.

```ts
const execution = createDurable(machine, {
  ...adapter,
  transitionIndex: checkpoint.nextTransitionIndex
});
const [snapshot, effects] = execution.restore(checkpoint.snapshot);
await execution.executeEffects(effects);
```
