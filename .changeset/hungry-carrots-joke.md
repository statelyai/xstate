---
'xstate': patch
---

Fixed an issue with `onDone` on parallel states not being "called" correctly when a parallel state had a history state defined directly on it.
