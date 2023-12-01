---
'xstate': major
---

Atomic and parallel states should no longer be reentered when the transition target doesn't escape them. You can get the reentering behavior by configuring `reenter: true` for the transition.
