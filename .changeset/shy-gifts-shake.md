---
'xstate': major
---

`.nextState` method has been removed from the `Interpreter`. `State#can` can be used to check if sending a particular event would lead to a state change.
