---
title: Persist and restore actors
description: Save an actor snapshot and restore it later.
---

Use `getPersistedSnapshot()` to get serializable actor state.

```ts
const actor = createActor(machine).start();
actor.send({ type: 'next' });
const stored = JSON.stringify(actor.getPersistedSnapshot());
actor.stop();
```

Pass the parsed snapshot to `createActor(...)` when restoring the actor.

```ts
const restored = createActor(machine, {
  snapshot: JSON.parse(stored)
}).start();
```

Persisted snapshots include persisted child actors. Store the machine version with each snapshot and keep external resources out of context.

Restore a checkout after a refresh or resume an order when the next webhook arrives. Do not restore an old snapshot with incompatible actor logic.
