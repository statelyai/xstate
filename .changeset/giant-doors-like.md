---
'xstate': minor
---

Add `maxIterations` option to configure the maximum number of microsteps allowed before throwing an infinite loop error. The default is `Infinity` (no limit) to avoid breaking existing machines.

You can configure it when creating a machine:

```ts
const machine = createMachine({
  // ... machine config
  options: {
    maxIterations: 1000 // set a limit to enable infinite loop detection
  }
});
```
