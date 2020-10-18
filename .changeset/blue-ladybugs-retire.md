---
'xstate': patch
---

The return type of `spawn(machine)` will now be `Actor<State<TContext, TEvent>, TEvent>`, which is a supertype of `Interpreter<...>`.
