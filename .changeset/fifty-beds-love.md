---
'xstate': patch
---

Removed `this` from machine snapshot methods to fix issues with accessing those methods from union of actors and their snapshots.
