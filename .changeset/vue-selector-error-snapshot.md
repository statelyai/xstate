---
'@xstate/vue': patch
---

`useSelector(…)` now updates its selected value when an actor errors. This also updates the `snapshot` returned by `useActor(…)` and `useMachine(…)`, so its `status` and `error` reflect the failure.
