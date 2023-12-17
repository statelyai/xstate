---
'xstate': patch
---

Update the argument object of `enqueueActions(...)` to include a `self` property:

```ts
// ...
entry: enqueueActions(({ self }) => {
  // ...
});
```
