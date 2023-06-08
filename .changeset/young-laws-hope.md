---
'xstate': major
---

Removed `State['actions']`. Actions are considered to be a side-effect of a transition, things that happen in the moment and are not meant to be persisted beyond that.
