---
'@xstate/test': minor
---

Add experimental `cover` support to `testPaths()`. Define named step predicates or consecutive step sequences to find and run the shortest walk that covers them within a search budget.

```ts
await testPaths(model, {
  sut,
  cover: {
    requirements: {
      consecutiveUndos: [
        ({ event }) => event.type === 'UNDO',
        ({ event }) => event.type === 'UNDO'
      ]
    }
  }
});
```
