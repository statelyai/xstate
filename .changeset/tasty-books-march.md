---
'xstate': patch
---

Eventless ("always") transitions will no longer be ignored if an event is sent to a machine in a state that does not have any enabled transitions for that event.
