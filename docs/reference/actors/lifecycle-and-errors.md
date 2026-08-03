---
title: Lifecycle and errors
description: Start, stop and observe actors safely.
---

An actor begins processing after `start()`. It stops after `stop()`, after reaching a final state or after an unhandled error.

```ts
actor.subscribe({
  next: (snapshot) => console.log(snapshot),
  error: (error) => console.error(error),
  complete: () => console.log('stopped')
});
```

Handle invoked actor failures with `onError`. Model expected outcomes as events or final outputs. Reserve thrown errors for failures the actor cannot handle locally.

Stopping a parent also stops its children.
