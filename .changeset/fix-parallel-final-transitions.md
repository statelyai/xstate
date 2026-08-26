---
'xstate': patch
---

Fix: Prevent transitions from final states within parallel regions

Final states are terminal by definition and should not allow outgoing transitions. Previously, events sent to a final state within a parallel region could incorrectly trigger transitions. Machines now fail fast at creation time if a final state declares `on`, `onDone`, `invoke`, `after`, `always`, or `route`, and `StateNode.next()` still returns `undefined` for final states as a safeguard.

Fixes #5460
