---
'@xstate/test': minor
---

Add experimental `cover` support to `testPaths()`. Define named step predicates or consecutive step sequences to find and run walks that collectively cover them. The planner prefers fewer SUT sessions, then fewer events. Set `maxPaths` to cap the number of sessions.

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
