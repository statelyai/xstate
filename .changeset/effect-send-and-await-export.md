---
'@xstate/effect': major
---

Move `sendAndAwait` to the main `@xstate/effect` export and remove the `/test` entrypoint. Document its one-event acknowledgment boundary: the transition and immediate effects, without awaiting child replies or background work.
