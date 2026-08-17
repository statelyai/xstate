---
'xstate': patch
---

`actor.getPersistedSnapshot()` is now typed to the actor’s logic, so persist/restore round-trips through `createActor(logic, { snapshot })` no longer require a cast. Restoring a snapshot into a machine with a different `id` is a type error, while snapshots from other versions of the same machine remain assignable (for runtime migration via `migrate`).

```ts
const actor = createActor(machine).start();
const snapshot = actor.getPersistedSnapshot();

// No cast needed:
const restored = createActor(machine, { snapshot }).start();
```
