---
'xstate': patch
---

Fixed crash on a `systemId` synchronous re-registration attempt that could happen, for example, when dealing with reentering transitions.
