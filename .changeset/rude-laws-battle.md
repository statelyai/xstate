---
'@xstate/react': major
---

The signatures of `useMachine` and `useService` integrating with `@xstate/fsm` were changed. They now only accept a single generic each (`TMachine` and `TService` respectively). This has been done to match their signatures with the related hooks that integrate with `xstate` itself.
