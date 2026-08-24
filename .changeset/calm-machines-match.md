---
'xstate': patch
---

Machine snapshots now retain their machine-specific methods when initialization fails, so methods such as `snapshot.matches(...)` remain available on error snapshots.
