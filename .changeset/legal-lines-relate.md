---
'@xstate/store': minor
---

Add `snapshot` parameter to `getTransactionId` function.

```ts
const store = createStore(
  undo(
    {
      // ...
    },
    {
      getTransactionId: (event, snapshot) =>
        snapshot.context.currentTransactionId
    }
  )
);
```
