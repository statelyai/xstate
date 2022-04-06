---
'@xstate/react': patch
---

`useMachine` for `xstate` now correctly rerenders with the initial state when the internal service is being restarted. This might happen during Fast Refresh and now you shouldn't be able to observe this stale state that didn't match the actual state of the service.
