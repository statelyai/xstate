---
'xstate': patch
---

Stopped actors are now properly cleaned up, even if they were stopped imperatively (e.g., by calling `actor.stop()` in an action).
