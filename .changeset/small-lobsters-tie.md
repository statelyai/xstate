---
'xstate': patch
---

Fixed an issue with `exit` actions sometimes being called twice when a machine reaches its final state and leads its parent to stopping it at the same time.
