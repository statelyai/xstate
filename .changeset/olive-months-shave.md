---
'xstate': major
---

All errors caught while executing the actor should now consistently include the error in its `snapshot.error` and should be reported to the closest `error` listener.
