---
'@xstate/store': minor
---

Added `createStoreConfig` to create a store config from an object. This is an identity function that returns the config unchanged, but is useful for type inference.

```tsx
const storeConfig = createStoreConfig({
  context: { count: 0 },
  on: { inc: (ctx) => ({ ...ctx, count: ctx.count + 1 }) }
});

// Reusable store config:

const store = createStore(storeConfig);

// ...
function Comp1() {
  const store = useStore(storeConfig);

  // ...
}

function Comp2() {
  const store = useStore(storeConfig);

  // ...
}
```
