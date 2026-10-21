---
'@xstate/scxml': patch
---

SCXML `done.invoke.<id>` and `done.state.<id>` transitions now match `xstate.done.actor` and `xstate.done.state` events by their `actorId` and `stateId`. Behavior is unchanged for SCXML documents.
