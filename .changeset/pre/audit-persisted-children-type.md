---
'xstate': patch
---

A persisted snapshot's `children` is now typed, so reading a persisted child no longer needs a cast. The new `PersistedActorRef` type describes both forms: an embedded child carries its own `snapshot`, while a child persisted by address carries `remote: true` and leaves its state with the runtime that owns it.

```ts
const persisted = actor.getPersistedSnapshot({ embedChildren: false });

persisted.children.auditor.address; // string | undefined
persisted.children.auditor.src; // string
```
