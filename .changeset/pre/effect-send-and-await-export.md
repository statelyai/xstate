---
'@xstate/effect': minor
---

Export `sendAndAwait` from the main `@xstate/effect` entrypoint. `@xstate/effect/test` still re-exports it for compatibility. Document its one-event acknowledgment boundary: the transition and immediate effects, without awaiting child replies or background work.
