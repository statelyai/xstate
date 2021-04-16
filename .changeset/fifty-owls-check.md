---
'xstate': patch
---

Provide a convenience type for getting the `Interpreter` type based on the `StateMachine` type by transferring all generic parameters onto it. It can be used like this: `InterpreterFrom<typeof machine>`
