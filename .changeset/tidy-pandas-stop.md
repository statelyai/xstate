---
"xstate": patch
---

Fixed child actors not being stopped when a machine errors because of an unhandled error from an invoked actor. The remaining invoked and spawned actors are now stopped (and their cleanup functions are called) before the machine settles in the error state, instead of being left running as orphans.
