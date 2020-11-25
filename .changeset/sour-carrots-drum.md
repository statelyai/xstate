---
'xstate': patch
---

Exit actions will now be properly called when a service gets canceled by calling its `stop` method.
