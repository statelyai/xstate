---
'xstate': patch
---

Fixed an issue that caused a `complete` listener to be called instead of the `error` one when the actor was subscribed after being stopped.
