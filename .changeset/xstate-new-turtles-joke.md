---
'xstate': major
---

Removed the deprecated `send` action creator. Please use `sendTo` when sending events to other actors or `raise` when sending to itself.
