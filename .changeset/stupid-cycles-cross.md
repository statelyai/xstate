---
'@xstate/graph': major
---

The `filter` and `stopCondition` option for path generation has been renamed to `stopWhen`, which is used to stop path generation when a condition is met. This is a breaking change, but it is a more accurate name for the option.

```diff
const shortestPaths = getShortestPaths(machine, {
  events: [{ type: 'INC' }],
- filter: (state) => state.context.count < 5
- stopCondition: (state) => state.context.count < 5
+ stopWhen: (state) => state.context.count === 5
});
```
