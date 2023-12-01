---
'xstate': minor
---

The `state` option of `createActor(...)` has been renamed to `snapshot`:

```diff
createActor(machine, {
- state: someState
+ snapshot: someState
})
```

Likewise, the `.getPersistedState()` method has been renamed to `.getPersistedSnapshot()`:

```diff
-actor.getPersistedState()
+actor.getPersistedSnapshot()
```
