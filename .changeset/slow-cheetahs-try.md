---
'xstate': minor
---

All `exit` actions in the machine will now be correctly resolved and executed when a machine gets stopped or reaches its final state. Previously the actions were not correctly resolved and that was leading to runtime errors.

To implement this fix in a reliable way a new special event has been introduced: `{ type: 'xstate.stop' }` and when machine stops its execution all exit handlers of its current state will be called with that event. You should always assume that an exit handler might be called with that event.
