---
'xstate': patch
---

Fixed memory leak - `State` objects had been retained in closures.
