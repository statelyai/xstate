---
'@xstate/graph': major
---

The `traversalLimit` option has been renamed to `limit`:

```diff
model.getShortestPaths({
- traversalLimit: 100
+ limit: 100
});
```
