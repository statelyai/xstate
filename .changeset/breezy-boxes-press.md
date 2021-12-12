---
'xstate': major
---

Strict mode is no longer available. Instead, wildcard transitions should be used to explicitly handle undesired events:

```diff
const machine = createMachine({
- strict: true,
  // ...
  on: {
+   '*': {
+     actions: (_, event) => {
+       throw new Error(`Event "${event.type}" not allowed`);
+     }
+   }
  }
})
```
