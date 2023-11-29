---
'xstate': major
---

All errors caught while executing the actor should now consistently error its snapshot and should be reported to the outermost `error` listener if they stay unhandled.
