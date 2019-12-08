---
'xstate': patch
---

Fixed issue with events being forwarded to children after being processed by the current machine. Events are now always forwarded first.
