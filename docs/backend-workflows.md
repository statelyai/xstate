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

Load, process, persist and stop the same entity actor for each request. This works for orders resumed by webhooks and approval flows resumed by an operator.

## One actor per entity

Use one workflow actor per entity or process: one per order, one per subscription, one per onboarding case. The actor is not a server that stays up. It exists for the length of a request, and its state lives in the database between requests.

Two requests for the same entity must not run at once. Both would restore the same snapshot, both would apply their event to it, and the second write would erase the first. Serialize per key: take a row lock on the workflow row, use a per-key queue, or write the snapshot conditionally on the version you read and retry the request when the compare-and-set fails. Different entities are independent and can run in parallel.

## Idempotency

Delivery is at-least-once almost everywhere: a webhook provider retries, a queue redelivers after a timeout, and an operator can double-click. Give every event an idempotency key and record the keys you have already applied.

```ts
export async function handleOrderEvent(
  orderId: string,
  event: { type: string },
  idempotencyKey: string
) {
  const stored = await database.orders.find(orderId);
  if (stored?.appliedKeys.includes(idempotencyKey)) {
    return stored.snapshot;
  }
  // restore, send, persist the snapshot and the key in one transaction
}
```

The same rule applies to writes the workflow makes. Pass an idempotency key to the payment provider or the email service so a replayed request does not charge or notify twice.

## Durable steps

Async logic that runs several external calls can record each one on the snapshot with `enq.step(...)`:

```ts
const fulfillOrder = createAsyncLogic({
  run: async ({ input }, enq) => {
    const charge = await enq.step('charge', () => chargeCard(input.amount));
    const label = await enq.step('ship', () => buyShippingLabel(input.address));
    return { charge, label };
  }
});
```

A restored actor replays a recorded step's result instead of running it again, so a resumed run does not charge the card twice. See [actor logic](actor-logic.md). Durable step semantics are experimental.

## Version the snapshots

A snapshot written today must remain readable by the code deployed next month. Give each machine a stable `id` and its own `version`, and register the versions you still need to read:

```ts
const orderVersions = machineVersions([orderV1, orderV2]);
const snapshot = await orderVersions.migrateSnapshot(stored.snapshot, {
  to: '2',
  migrations: {
    '1': async (snapshot) => ({
      ...snapshot,
      context: { ...snapshot.context, currency: 'USD' }
    })
  }
});
```

Store the version alongside the snapshot so a restored workflow is either migrated or rejected, never silently misread. See [persistence](persistence.md).

## Request-response endpoints

Some endpoints have to answer with the result, not just acknowledge the event. Start the actor, send the event and wait for the snapshot you need:

```ts
import { waitFor } from 'xstate';

const order = createActor(orderMachine, { snapshot: stored?.snapshot }).start();
order.send({ type: 'confirm' });

const settled = await waitFor(
  order,
  (snapshot) => snapshot.matches('confirmed') || snapshot.matches('rejected'),
  { timeout: 10_000 }
);
```

`waitFor(...)` rejects when the timeout elapses, which keeps a stuck workflow from holding the request open. Persist the snapshot before returning, whichever way it settled.

## Long delays across restarts

Pending delayed transitions are part of the snapshot: `snapshot.timers` lists each one with its stable id, its declared delay and the event it will deliver, and no wall-clock timestamps. Restoring that snapshot restarts each timer with its full declared delay, so time that passed while no process was running is not counted. A three-day `after` restarted on every deploy never fires.

For deadlines that must respect real time, persist the scheduled and due times next to the snapshot and have the host (a scheduler, a queue with a visibility timeout, or a cron job) deliver the event when it is due. Keep short delays such as debounces and retry backoffs inside the machine, where restarting the delay has little effect.

## What next?

- [Persist and version snapshots](persistence.md).
- [Retry failed steps and bound how long they may run](retries-and-timeouts.md).
- [Write the async logic a workflow invokes](actor-logic.md).
- [See a working Express implementation](examples.md).
