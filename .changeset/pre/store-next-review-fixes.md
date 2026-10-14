---
'@xstate/store': patch
'@xstate/store-react': patch
---

`flushStorage(store)` now also waits for writes queued by `onDone`. With `strategy: 'event'`, events sent after `clearStorage(store)` start a new history. Calling `store.can` or `store.transition` preserves the history reset, and changes made before hydration are included in the new checkpoint when rehydrating from empty storage.

`useStore`'s `inspect` option only changes after a render commits; a suspended or discarded render no longer redirects inspection events.
