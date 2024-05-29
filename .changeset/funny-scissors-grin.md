---
'@xstate/graph': major
---

pr: #4896
commit: 7c6e2ea

The `traversalLimit` option has been renamed to `limit`:

```diff
model.getShortestPaths({
- traversalLimit: 100
+ limit: 100
});
```
