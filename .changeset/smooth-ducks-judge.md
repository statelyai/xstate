---
'xstate': patch
---

Adds support for calling `send` with a string as the event type to `spawnBehavior`.
This aligns actors that are spawned from behavior with actors that are spawned from machines.

```typescript
const actor = spawnBehavior(/* ... */);

actor.send('test'); // Will be converted to an event object {type: "test"}
actor.send({ type: 'test' }); // Continues to work as before
```
