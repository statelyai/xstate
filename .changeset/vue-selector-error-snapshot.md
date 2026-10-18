---
'@xstate/vue': patch
---

`useSelector(…)` now updates the selected value when the actor errors. Before, the error snapshot (`status: 'error'`) was never selected, because actors deliver errors through the observer's `error` callback rather than `next`, so the ref kept the last active value. This also applies to the `snapshot` returned by `useActor(…)` and `useMachine(…)`, which is built on `useSelector(…)`.
