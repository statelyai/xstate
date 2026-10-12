---
'@xstate/store': patch
'@xstate/store-react': patch
---

`flushStorage(store)` now also waits for writes queued by `onDone`. With `strategy: 'event'`, events sent after `clearStorage(store)` start a new history.

`useStore`'s `inspect` option only changes after a render commits; a suspended or discarded render no longer redirects inspection events.
