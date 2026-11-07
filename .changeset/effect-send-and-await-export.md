---
'@xstate/effect': patch
---

Move `sendAndAwait` to the main `@xstate/effect` export and remove the `/test` entrypoint. Document its one-event acknowledgment boundary: the transition and immediate effect handoff, without awaiting child replies or background work.
