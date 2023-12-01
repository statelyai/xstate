---
'@xstate/vue': major
---

Removed `getSnapshot` parameter from composables. It is expected that the received `actorRef` has to have a `getSnapshot` method on it that can be used internally.
