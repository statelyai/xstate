---
'xstate': major
---

The output data on final states is now specified as `.output` instead of `.data`:

```diff
const machine = createMachine({
  // ...
  states: {
    // ...
    success: {
-     data: { message: 'Success!' }
+     output: { message: 'Success!' }
    }
  }
})
```
