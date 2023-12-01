---
'xstate': minor
---

`State.from`, `StateMachine#createState` and `StateMachine#resolveStateValue` were removed. They largely served the same purpose as `StateMachine#resolveState` and this is the method that is still available and can be used instead of them.
