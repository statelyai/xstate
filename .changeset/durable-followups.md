---
'xstate': patch
---

Durable executions can pin a deterministic identity: `createDurable(machine, { executionId, ... })` makes session ids `<executionId>:<n>`, a deterministic function of actor-creation order, so hosts that journal the execution's own events can replay them — a journaled completion event still matches the child a replay re-creates.

```ts
const durable = createDurable(machine, {
  executionId: orderId,
  executeAction,
  waitForEvent
});
```

Durable-execution docs now also cover quiescing in-flight steps before registering a durable wait, the ordered-effect replay guarantee, and that `runStep`'s `exec` closure must run in-process.
