---
'@xstate/graph': major
---

The test model "sync" methods have been removed, including:

- `testModel.testPathSync(…)`
- `testModel.testStateSync(…)`
- `testPath.testSync(…)`

The `async` methods should always be used instead.

```diff
model.getShortestPaths().forEach(async (path) => {
- model.testPathSync(path, {
+ await model.testPath(path, {
    states: { /* ... */ },
    events: { /* ... */ },
  });
})
```
