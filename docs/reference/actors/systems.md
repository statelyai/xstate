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
