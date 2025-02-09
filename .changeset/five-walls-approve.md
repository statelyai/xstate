---
'@xstate/store': major
---

The `createStore` function now only accepts a single configuration object argument. This is a breaking change that simplifies the API and aligns with the configuration pattern used throughout XState.

```ts
// Before
// createStore(
//   {
//     count: 0
//   },
//   {
//     increment: (context) => ({ count: context.count + 1 })
//   }
// );

// After
createStore({
  context: {
    count: 0
  },
  on: {
    increment: (context) => ({ count: context.count + 1 })
  }
});
```
