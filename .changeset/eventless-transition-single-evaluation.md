---
'xstate': patch
---

Fixed eventless (`always`) transition functions being called twice per microstep. The evaluation that selects the transition is now the one that is executed, as for event transitions, so a transition function that returns different results on repeated calls no longer follows a result other than the one it was selected with. This does not cover transition functions that call `enq.spawn`, `enq.listen`, or `enq.subscribeTo`: those are still evaluated again when applied, since the selection-time evaluation aborts before it can produce a result.
