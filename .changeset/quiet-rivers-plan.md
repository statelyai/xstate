---
'xstate': minor
---

Add an experimental `createDurableSystem()` planner with persistable logical
actor identities, serializable normalized effects, system checkpoint and restore
helpers, ordered host execution, explicit stale child-event rejection, and inert
logical child handles that avoid constructing runtime actors during planning.
The system planner can route events to any logical actor and includes nested
initialization effects in one ordered plan.

```ts
const durable = createDurableSystem(machine);
const { state, effects } = durable.initialTransition(input);
const checkpoint = durable.getPersistedSystemSnapshot(state);
```
