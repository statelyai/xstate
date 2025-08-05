---
'xstate': patch
---

Fix: Emit callback errors no longer crash the actor

```ts
actor.on('event', () => {
  // Will no longer crash the actor
  throw new Error('oops');
});
```
