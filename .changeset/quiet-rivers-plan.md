---
'xstate': minor
---

Add an experimental `createDurableSystem()` planner with persistable logical
actor identities, serializable normalized effects, system checkpoint and restore
helpers, ordered host execution, explicit stale child-event rejection, and inert
logical child handles that avoid constructing runtime actors during planning.

```ts
const durable = createDurableSystem(machine);
const { state, effects } = durable.initialTransition(input);
const checkpoint = durable.getPersistedSystemSnapshot(state);
```
