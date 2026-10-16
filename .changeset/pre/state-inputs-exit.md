---
'xstate': patch
---

State inputs are removed when their state exits. `snapshot.getInputs()` and persisted snapshots only include inputs for active states.
