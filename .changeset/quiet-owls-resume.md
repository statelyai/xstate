---
'@xstate/effect': patch
---

`createEffectActor` accepts a persisted snapshot. The actor resumes in the persisted state and context without re-running entry actions, and pending delayed transitions keep their original deadlines on Effect's `Clock`.

```ts
const saved = actor.getPersistedSnapshot();
// later, possibly in another process
const restored = yield* createEffectActor(machine, { snapshot: saved });
```

Children that were running when the snapshot was taken start again from the beginning, as they do with XState's `createActor(logic, { snapshot })`.
