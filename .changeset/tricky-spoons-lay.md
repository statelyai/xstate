---
'@xstate/react': major
---

Removed `getSnapshot` parameter from hooks. It is expected that the received `actorRef` has to have a `getSnapshot` method on it that can be used internally.
