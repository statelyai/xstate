---
'@xstate/graph': major
---

pr: #3036
author: @davidkpiano

Changed `getSimplePaths` to `getSimplePlans`, and `getShortestPaths` to `getShortestPlans`. Both of these functions can be passed a machine, and return `StatePlan[]`.

Added functions `traverseSimplePlans`, `traverseShortestPlans`,`traverseShortestPlansFromTo`, `traverseSimplePlansTo` and `traverseSimplePlansFromTo`, which can be passed a `Behavior` and return `StatePlan[]`.
