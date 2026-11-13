---
'xstate': minor
'@xstate/effect': minor
---

Callback, event observable, listener, and subscription actors now process events they send to a parent in their own transitions. `createEffectEventStreamLogic` actors do the same. Inspection reports each outgoing event on the source transition, and subscribers receive a snapshot notification for that transition.
