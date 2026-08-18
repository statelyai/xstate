---
'xstate': minor
---

Add an experimental `createDurableSystem()` planner with persistable logical
actor identities, serializable normalized effects, system checkpoint and restore
helpers, ordered host execution, and explicit stale child-event rejection.

```ts
const durable = createDurableSystem(machine);
const { state, effects } = durable.initialTransition(input);
const checkpoint = durable.getPersistedSystemSnapshot(state);
```
