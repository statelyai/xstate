---
'xstate': patch
---

Transitions that read `self` or `system` no longer keep earlier snapshots alive.
