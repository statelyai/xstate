---
'xstate': minor
---

The `state.meta` and `state.nextEvents` getters have been replaced with `state.getMeta()` and `state.getNextEvents()` methods:

```diff
- state.meta
+ state.getMeta()

- state.nextEvents
+ state.getNextEvents()
```
