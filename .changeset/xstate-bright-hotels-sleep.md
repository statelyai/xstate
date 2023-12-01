---
'xstate': major
---

If context types are specified in the machine config, the `context` property will now be required:

```ts
// ❌ TS error
createMachine({
  types: {} as {
    context: { count: number };
  }
  // Missing context property
});

// ✅ OK
createMachine({
  types: {} as {
    context: { count: number };
  },
  context: {
    count: 0
  }
});
```
