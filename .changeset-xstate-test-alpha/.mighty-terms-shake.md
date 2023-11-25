---
'@xstate/graph': patch
'@xstate/test': patch
---

The `serializeState()` path traversal option now provides 3 arguments to the function passed in:

1. `state` - the current state
2. `event` - the event that caused traversal to this state
3. `prevState` 🆕 - the state before the current state (may be `undefined`)
