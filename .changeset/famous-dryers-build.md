---
'xstate': patch
---

The `state.can(...)` method no longer unnecessarily executes `assign()` actions and instead determines if a given event will change the state by reading transition data before evaluating actions.
