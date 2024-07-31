---
'xstate': patch
---

The internal types for `StateMachine<...>` have been improved so that all type params are required, to prevent errors when using the types. This fixes weird issues like #5008.
