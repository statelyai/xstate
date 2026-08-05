---
title: Persistence
description: Save and restore actor state.
---

Call `getPersistedSnapshot()` to get serializable actor state.

```ts
const persisted = actor.getPersistedSnapshot();
localStorage.setItem('checkout', JSON.stringify(persisted));
```

Restore the actor with the `snapshot` option.

```ts
const restored = createActor(machine, {
  snapshot: JSON.parse(localStorage.getItem('checkout')!)
}).start();
```

Persisted snapshots may include child actor state. Keep the actor logic compatible with snapshots already stored by your application.

Persistence is useful for a checkout resumed after a refresh and a backend order workflow resumed by a later request.

Store a machine version with each snapshot. Migrate or discard old snapshots when states, context or child actor logic change. Keep database clients, sockets and other live resources outside context.

Persisted snapshots record current state. Event sourcing records the events that produced it. Use event sourcing only when the event history itself is required.

## Persistence cheatsheet

```ts
const persisted = actor.getPersistedSnapshot();
const restored = createActor(logic, { snapshot: persisted }).start();
```
