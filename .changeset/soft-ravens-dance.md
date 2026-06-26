---
'@xstate/store': patch
---

Fixed inference for selector `context` parameters when using `createStoreLogic(...)` with an input function.

```ts
const counterLogic = createStoreLogic({
  context: (input: { initialCount: number }) => ({ count: input.initialCount }),
  selectors: {
    count: (context) => context.count
  },
  on: {
    inc: (context) => ({ count: context.count + 1 })
  }
});
```
