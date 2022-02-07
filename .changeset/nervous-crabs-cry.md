---
'xstate': patch
---

Fixed an issue with states created using `machine.getInitialState` not being "resolved" in full. This could cause some things, such as `after` transitions, not being executed correctly after starting an interpreter using such state.
