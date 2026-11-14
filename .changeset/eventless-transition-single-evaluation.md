---
'xstate': patch
---

Fixed eventless (`always`) transition functions being called twice per microstep. The evaluation that selects the transition is now the one that is executed, as for event transitions, so a transition function that returns different results on repeated calls no longer follows a result other than the one it was selected with.
