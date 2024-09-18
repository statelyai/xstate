---
'@xstate/store': patch
---

The `useSelector(…)` hook will no longer result in an infinite loop when an object-like value is returned from the selector function.
