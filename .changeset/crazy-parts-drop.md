---
'xstate': patch
---

Make `actor.systemId` public:

```ts
const actor = createActor(machine, { systemId: 'test' });
actor.systemId; // 'test'
```
