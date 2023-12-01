---
'xstate': major
---

Eventless transitions must now be specified in the `always: { ... }` object and not in the `on: { ... }` object:

```diff
someState: {
  on: {
    // Will no longer work
-   '': { target: 'anotherState' }
  },
+ always: { target: 'anotherState' }
}
```
