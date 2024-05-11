---
'@xstate/store': patch
---

The `context` type for `createStoreWithProducer(producer, context, transitions)` will now be properly inferred.

```ts
const store = createStoreWithProducer(
  produce,
  {
    count: 0
  },
  {
    // ...
  }
);

store.getSnapshot().context;
// BEFORE: StoreContext
// NOW: { count: number }
```
