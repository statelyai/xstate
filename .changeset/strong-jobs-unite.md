---
'xstate': patch
---

Update the argument object of `enqueueActions(...)` to include the `self` and `system` properties:

```ts
// ...
entry: enqueueActions(({ self, system }) => {
  // ...
});
```
