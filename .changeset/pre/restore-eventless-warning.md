---
'xstate': patch
---

Restoring a snapshot whose state has `always` transitions or is a choice state now logs a development warning: restored snapshots are not re-evaluated, so those eventless transitions do not run until the next event.
