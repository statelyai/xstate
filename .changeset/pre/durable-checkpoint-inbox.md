---
'xstate': minor
---

`durable.checkpoint(snapshot)` returns a checkpoint that `restore()` accepts: the persisted snapshot, the next transition index, and the inbox of root-addressed events that settled `executeEffects` batches captured but `waitForEvent()` has not handed out. A child that completed in the last batch before a checkpoint now reaches its parent after restore, instead of leaving the parent waiting.

```ts
await db.save(durable.checkpoint(state));

const resumed = createDurable(machine, adapter);
let [state, effects] = resumed.restore(await db.load());
await resumed.executeEffects(effects);
```

`restore()` still accepts a bare persisted snapshot.

Long-running durable executions no longer slow down or retain earlier snapshot system views as transitions accumulate. Executions that start from the same snapshot keep separate runtimes, timers and listeners.
