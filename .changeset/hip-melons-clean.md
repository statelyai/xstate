---
'xstate': major
---

Persisted state will no longer contain actions, since they have already been executed. Actions will not be replayed.

If you want to replay actions when restoring state, it is recommended to use an event sourcing approach.
