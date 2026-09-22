---
'@xstate/svelte': patch
'@xstate/solid': patch
'@xstate/vue': patch
'@xstate/store-react': patch
'@xstate/store-solid': patch
---

Keep selected values current when subscriptions start or resume. Vue and Solid now expose terminal error snapshots, and Solid preserves array/object context changes without changing the actor's source data. Vue uses one snapshot subscription per `useActor` call.

React store selectors now honor custom comparisons when the selector argument is omitted.
