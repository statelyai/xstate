---
'xstate': patch
---

Fixed a TS inference issue causing some functions to infer the constraint type for the event type even though a `StateMachine` passed to the function was parametrized with a concrete type for the event. More information can be found [here](https://github.com/statelyai/xstate/issues/3141#issuecomment-1063995705).
