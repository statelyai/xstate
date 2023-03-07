---
'@xstate/test': major
---

pr: #3036
author: @davidkpiano

Removed `.testCoverage()`, and instead made `getPlans`, `getShortestPlans` and `getSimplePlans` cover all states and transitions enabled by event cases by default.
