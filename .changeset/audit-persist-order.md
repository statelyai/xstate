---
'@xstate/store': patch
---

Persist only committed updates when throttling writes. Capability checks, pure transitions, and rejected updates no longer change pending persisted data.

Async storage writes now complete in event order per store. `flushStorage(store)` also waits for already queued writes; synchronous storage remains synchronous.
