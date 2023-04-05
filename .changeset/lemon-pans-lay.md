---
'xstate': major
---

Actors can no longer be stopped directly by calling ~~`actor.stop()`~~. They can only be stopped from its parent internally (which might happen when you use `stop` action or automatically when a machine leaves the invoking state). The root actor can still be stopped since it has no parent.
