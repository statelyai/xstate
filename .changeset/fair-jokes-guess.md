---
'xstate': patch
---

Invoked actors will no longer be automatically started (added to `.children`) when those children are missing in the persisted state.
