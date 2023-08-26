---
'xstate': minor
---

You can now specify guard types for machines:

```ts
createMachine({
  types: {} as {
    guards:
      | {
          type: 'isGreaterThan';
          params: {
            count: number;
          };
        }
      | { type: 'plainGuard' };
  }
  // ...
});
```
