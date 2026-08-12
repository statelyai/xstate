---
title: Run backend workflows
description: Restore a workflow, process an event and persist the next snapshot.
---

Backend workflows usually have a longer lifetime than one request. Persist their snapshots between requests.

```ts
export async function handleOrderEvent(orderId: string, event: unknown) {
  const stored = await database.orders.find(orderId);
  const order = createActor(orderMachine, {
    input: { orderId },
    snapshot: stored?.snapshot
  }).start();

  order.send(event as { type: string });
  await database.orders.save(orderId, {
    snapshot: order.getPersistedSnapshot()
  });

  const snapshot = order.getSnapshot();
  order.stop();
  return snapshot;
}
```

Use one workflow actor per entity or process. Give external writes an idempotency key. Store a machine version with each snapshot.

This works for orders resumed by webhooks and approval flows resumed by an operator. Load, process, persist and stop the same entity actor for each request.
