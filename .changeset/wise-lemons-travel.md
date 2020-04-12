---
'@xstate/fsm': patch
---

`StateMachine.Config` type accepts now a third type parameter - `TState` - similarly to other existing types. When provided it provides helpful intellisense when defining the state chart transitions.
