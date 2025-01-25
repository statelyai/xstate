---
'@xstate/store': major
---

The `createStoreWithProducer(…)` function now only accepts two arguments: a `producer` and a config (`{ context, on }`) object.

```ts
// Before
// createStoreWithProducer(
//   producer,
//   {
//     count: 0
//   },
//   {
//     increment: (context) => ({ count: context.count + 1 })
//   }
// );

// After
createStoreWithProducer(producer, {
  context: {
    count: 0
  },
  on: {
    increment: (context) => ({ count: context.count + 1 })
  }
});
```
