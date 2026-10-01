---
'@xstate/store': patch
---

Preserve cleared event history when checking event capabilities or evaluating transitions without committing them. Clearing storage from a subscriber no longer allows the current update to write the cleared data back.

Keep newly hydrated event history after clearing an earlier log.
