---
'xstate': patch
---

Fix: parallel final states are now truly final

A final state inside a parallel region could incorrectly allow outgoing
transitions if transitions were defined on it. `StateNode.next()` now
returns `undefined` immediately for any `final`-type state node,
matching the SCXML specification that final states are terminal and
cannot have outgoing transitions.

Fixes #5460
