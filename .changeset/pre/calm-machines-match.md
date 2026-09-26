---
'xstate': patch
---

Machine snapshots keep their machine-specific methods, such as `snapshot.matches(...)`, when initialization fails (for example, when the `context` factory throws).
