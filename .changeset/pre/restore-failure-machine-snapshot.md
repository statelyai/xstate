---
'xstate': patch
---

A persisted snapshot that fails to restore (for example, an unknown state in `value` or a machine id mismatch) now produces a full machine snapshot with `status: 'error'` and the failure as `error`, instead of a bare `{ status, output, error }` object. `snapshot.matches(...)`, `snapshot.can(...)` and the other snapshot methods keep working.
