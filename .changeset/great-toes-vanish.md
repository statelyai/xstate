---
'xstate': patch
---

Fixed an issue with invoked service not being correctly started if other service got stopped in a subsequent microstep (in response to raised or null event).
