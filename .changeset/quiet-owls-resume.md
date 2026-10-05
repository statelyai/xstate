---
'@xstate/effect': patch
---

`createEffectActor` accepts a persisted snapshot. The actor resumes in the persisted state and context without re-running entry actions, and pending delayed transitions keep their original deadlines on Effect's `Clock`.

```ts
const saved = actor.getPersistedSnapshot();
// later, possibly in another process
const restored = yield* createEffectActor(machine, { snapshot: saved });
```

State-machine children resume their persisted state, and completed children do not restart. Running Effect tasks and streams, including a root `fromEffect` or `fromEffectStream` actor, restart from the beginning, as running async and callback actors do with XState's `createActor(logic, { snapshot })`. A snapshot-only restore does not need `input`.
