---
'@xstate/store': patch
---

Preserve cleared event history when checking event capabilities or evaluating transitions without committing them. Clearing storage from a subscriber no longer allows the current update to write the cleared data back.

Keep newly hydrated event history after clearing an earlier log.

Persistence effects from uncommitted `store.transition(...)` calls no longer write snapshot data after `clearStorage(store)`. A `rehydrateStore(store)` read that started before `clearStorage(store)` no longer restores the cleared data.
