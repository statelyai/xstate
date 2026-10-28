---
"xstate": patch
---

Reject malformed persisted state values, children, and timers consistently during snapshot parsing and restoration. Invalid snapshots now produce an `InvalidSnapshotError` instead of an incidental `TypeError` or plain `Error`.

Report unhandled public `xstate.*` events through `onUnhandledEvent` and development warnings, including obsolete suffixed lifecycle names such as `xstate.done.actor.save`.

Reject the removed `parent` option passed to `createActor` with migration guidance. Create child actors through `invoke`, `spawn`, or `enq.spawn`.
