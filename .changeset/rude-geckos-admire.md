---
'xstate': minor
---

The `cond` property has been deprecated in favor of the `guards` property. The `cond` property will be renamed in the next major version.

```diff
const machine = createMachine({
  // ...
  on: {
    EVENT: {
-     cond: (context, event) => { ... },
+     guard: (context, event) => { ... },
    }
  }
})
```
