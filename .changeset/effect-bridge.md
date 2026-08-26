---
'@xstate/effect': minor
'xstate': patch
---

Add experimental Effect 4 integration for XState v6, including Effect-backed actors, streams, typed requirements and failures, and Effect actions.

```ts
const actor = await Effect.runPromise(createEffectActor(machine));
```
