---
'xstate': patch
---

The `pure(...)` action creator is now properly typed so that it allows function actions:

```ts
actions: pure(() => [
  // now allowed!
  (context, event) => { ... }
])
```
