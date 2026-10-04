---
'@xstate/store': patch
---

Fix async atoms losing their dependencies after a request succeeds or fails. Changing a dependency now reloads the value after settlement, including when a custom comparator suppresses an equivalent result.

Fix writable atom updaters accidentally tracking other atoms, and deliver queued subscriber notifications before rethrowing subscriber errors.

Persist only committed updates when throttling writes. Capability checks, pure transitions, and rejected updates no longer change pending persisted data. Async storage writes now complete in event order per store. `flushStorage(store)` also waits for already queued writes, including writes queued by `onDone`; synchronous storage remains synchronous.

Preserve the latest persisted state when effects or subscriptions synchronously trigger another event. Snapshot and event persistence now retain commit order with immediate or throttled writes.

Preserve live extension state through snapshot undo/redo and custom restore events. Fix throttled persistence applying `pick` twice or losing changes sent from `onDone`. Report initial async storage read failures through `onError`, and make `clearStorage` cancel buffered writes and wait for queued writes before removing data. With `strategy: 'event'`, events sent after `clearStorage` start a new history instead of rewriting the cleared one.

Improve large batches of triggered events while preserving their processing and effect order.
