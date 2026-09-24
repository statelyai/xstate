---
'@xstate/react': patch
'xstate': patch
---

React Fast Refresh no longer serializes the running actor's snapshot when a machine is edited. In development builds, `useActorRef()`, `useActor()` and `useMachine()` keep the running actor and switch it to the edited machine, carrying over the current state and context as they are. Context that `getPersistedSnapshot()` cannot represent, such as DOM elements or cyclic objects, no longer throws.

A fresh actor is started instead when the current state no longer exists in the edited machine, or when a configured validator rejects the current context. Invoked actors whose logic did not change keep running; the others are restarted. Production builds are unaffected.
