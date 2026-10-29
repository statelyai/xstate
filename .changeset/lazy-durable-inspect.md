---
'xstate': minor
---

Add `isInspected` to `createDurable` options: `inspect` is attached only while it returns `true`, so an execution nobody observes builds no inspection events.
