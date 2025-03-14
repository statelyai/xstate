---
'@xstate/store': minor
---

Added `store.transition(state, event)` method that returns the next state and effects for a given state and event as a tuple, without actually updating the store. This is useful for computing state changes before committing them, or controlling the execution of effects.

Example:

```ts
const [nextState, effects] = store.transition(store.getSnapshot(), {
  type: 'increment',
  by: 1
});
```
