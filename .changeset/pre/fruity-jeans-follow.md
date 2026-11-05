---
'@xstate/scxml': patch
'xstate': patch
---

Clarify how imported SCXML machines differ from native XState v6 machines, including transition domains, event matching, error handling, and the supported execution profile.

Fix SCXML executable content ordering: all state exits finish before selected transition content runs, and all transition content finishes before state entry. Scripts can mutate declared arrays and plain objects while preserving previous snapshots.
