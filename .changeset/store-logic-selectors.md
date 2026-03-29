---
'@xstate/store': minor
---

Added `createStoreLogic` for reusable store definitions with input and `selectors` support for both `createStore` and `createStoreLogic`.

```ts
const counterLogic = createStoreLogic({
  context: (input: { initialCount: number }) => ({
    count: input.initialCount
  }),
  on: {
    inc: (ctx) => ({ count: ctx.count + 1 })
  },
  selectors: {
    doubled: (ctx) => ctx.count * 2
  }
});

const counter1 = counterLogic.createStore({ initialCount: 42 });
const counter2 = counterLogic.createStore({ initialCount: 0 });

counter1.selectors.doubled.get(); // 84
```

Selectors are reactive `ReadonlyAtom`s (powered by `store.select()`), composable with `createAtom`, and preserved through `.with()` extensions.
