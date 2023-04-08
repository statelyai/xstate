---
'xstate': major
---

Restored state will no longer contain actions, since they are assumed to have already been executed. Actions will not be replayed.

If you want to replay actions when restoring state, it is recommended to use an event sourcing approach.
