---
'xstate': patch
---

Fix: Prevent transitions from final states within parallel regions

Final states are terminal by definition and should not allow outgoing transitions. Previously, events sent to a final state within a parallel region could incorrectly trigger transitions. This fix ensures that `StateNode.next()` returns `undefined` for final states, preventing any transitions from occurring.

Fixes #5460
