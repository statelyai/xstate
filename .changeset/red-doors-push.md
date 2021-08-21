---
'xstate': minor
---

Passing in a `Model` type as a generic type in `createMachine<typeof someModel>` is no longer allowed:

```ts
// Will not compile and show error containing:
// "Model type no longer supported as generic type.
// Please use `model.createMachine(...)` instead."
const machine = createMachine<typeof someModel>({
  // ...
});
```

The `model.createMachine(...)` method should be used instead:

```diff
-const machine = createMachine<typeof someModel>({
+const machine = someModel.createMachine({
  // ...
});
```
