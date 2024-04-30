---
'xstate': patch
---

XState will now warn when calling built-in actions like `assign`, `sendTo`, `raise`, `emit`, etc. directly inside of a custom action. See https://stately.ai/docs/actions#built-in-actions for more details.

```ts
const machine = createMachine({
  entry: () => {
    // Will warn:
    // "Custom actions should not call \`assign()\` directly, as it is not imperative. See https://stately.ai/docs/actions#built-in-actions for more details."
    assign({
      // ...
    });
  }
});
```
