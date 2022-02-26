---
'xstate': patch
---

State that is persisted and restored from `machine.resolveState(state)` will now have the correct `state.machine` value, so that `state.can(...)` and other methods will work as expected.

See #3096 for more details.
