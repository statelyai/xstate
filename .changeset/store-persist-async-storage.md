---
'@xstate/store': major
---

Update `persist(...)` helpers to support async storage results.

`clearStorage(...)` and `flushStorage(...)` may return a promise when the configured storage is async.
