---
title: Actor systems
description: Address actors within the same actor system.
---

Every root actor creates an actor system. Descendant actors belong to that system.

Register an actor with `registryKey`, then look it up with `system.get(...)`.

```ts
const worker = enq.spawn(workerLogic, {
  registryKey: 'primary-worker'
});

const primaryWorker = system.get('primary-worker');
```

The registry entry is removed when the actor stops. Prefer direct child references when the parent already owns the child.

Registry keys must be unique within the system. Use them for actors that need to communicate across ownership boundaries, such as a notification service or a shared connection actor.

```ts
on: {
  notify: ({ system, event }, enq) => {
    const notifications = system.get('notifications');
    if (notifications) enq.sendTo(notifications, event);
  }
}
```

## Actor systems cheatsheet

```ts
const child = enq.spawn(logic, { registryKey: 'service' });
const service = system.get('service');
```
