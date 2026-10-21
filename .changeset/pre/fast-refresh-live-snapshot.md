---
'@xstate/react': patch
'xstate': patch
---

React Fast Refresh keeps the running actor and its state when you edit a machine. In development builds, `useActorRef()`, `useActor()` and `useMachine()` switch the running actor to the edited machine, so the current state and context are kept, including context that holds DOM elements or cyclic objects. If the edited machine cannot represent the current state, the actor restarts from the edited machine. Production builds are unaffected.
