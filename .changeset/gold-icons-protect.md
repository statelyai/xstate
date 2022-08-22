---
'xstate': patch
---

Fixed an issue that caused `invoke`d actors to be created before resolving `assign` actions from `entry` of the same state.
