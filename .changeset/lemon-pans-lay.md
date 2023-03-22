---
'xstate': major
---

Actors can no longer be stopped directly by calling ~~`actor.stop()`~~. They can only be stopped from its parent, or by stopping the entire system via `actorRef.system.stop()`, which will stop all other actors too.
