---
'xstate': minor
---

You can now define strict tags for machines:

```ts
createMachine({
  types: {} as {
    tags: 'pending' | 'success' | 'error';
  }
  // ...
});
```
