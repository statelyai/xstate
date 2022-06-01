---
'xstate': patch
---

Fixed an issue with actors not being reinstantiated correctly when an actor with the same ID was first stopped and then invoked/spawned again in the same microstep.
