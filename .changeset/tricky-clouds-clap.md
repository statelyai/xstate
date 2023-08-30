---
'xstate': minor
---

You can now specify delay types for machines:

```ts
createMachine({
  types: {} as {
    delays: 'one second' | 'one minute';
  }
  // ...
});
```
