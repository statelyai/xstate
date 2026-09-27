---
'xstate': patch
---

Restoring a persisted snapshot with `status: 'stopped'` now yields a stopped actor. Previously the restored actor kept processing events, running transitions and actions while reporting `status: 'stopped'`.
