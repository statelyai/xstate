---
'xstate': minor
---

The model created from `createModel(...)` now provides a `.createMachine(...)` method that does not require passing any generic type parameters:

```diff
const model = createModel(/* ... */);

-const machine = createMachine<typeof model>(/* ... */);
+const machine = model.createMachine(/* ... */);
```
