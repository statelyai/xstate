---
'@xstate/store': minor
---

Added store getters API for computed values derived from context:

```ts
const store = createStore({
  context: { count: 2 },
  getters: {
    doubled: (ctx) => ctx.count * 2,
    squared: (ctx) => ctx.count ** 2,
    // Can depend on other getters (types can not be inferred, due to circular references)
    sum: (ctx, getters: { doubled: number; squared: number }) =>
      getters.doubled + getters.squared
  },
  on: {
    inc: (ctx) => ({ count: ctx.count + 1 })
  }
});

// Getters are available on store snapshots
var getters = store.getSnapshot().getters;
assert.equal(getters.doubled, 4);
assert.equal(getters.squared, 4);
assert.equal(getters.sum, 8);

// Automatically update when context changes
store.send({ type: 'inc' });
var getters = store.getSnapshot().getters;
assert.equal(getters.doubled, 6);
assert.equal(getters.squared, 36);
assert.equal(getters.sum, 42);
```

Key features:

- Getters recalculate automatically when context changes
- Included in inspection snapshots
- Can depend on other getters via proxy
- Works with Immer producer API
- Full type safety for computed values
