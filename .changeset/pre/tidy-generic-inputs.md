---
'xstate': patch
---

Fixed generic type helpers that accidentally restricted invocation transition metadata, state input, and transition children. `AnyInvokeDefinition`, `AnyStateNodeConfig`, and `AnyTransitionConfigFunction` now preserve arbitrary types in these positions when inspecting or accepting configurations from different machines.
