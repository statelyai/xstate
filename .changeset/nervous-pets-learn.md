---
'@xstate/react': patch
---

`useMachine` for `@xstate/fsm` now starts the service in an effect. This avoids side-effects in render and improves the compatibility with `StrictMode`.
