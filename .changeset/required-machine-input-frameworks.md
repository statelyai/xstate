---
'@xstate/react': patch
'@xstate/vue': patch
'@xstate/svelte': patch
'@xstate/solid': patch
---

`useActor`, `useActorRef` and `useMachine` now require `input` for machines that declare a required input schema, matching `createActor`. Passing a persisted `snapshot` instead of `input` is allowed.
