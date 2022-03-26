---
'xstate': patch
---

Fixed an issue with `state.tags` not having correct values when resolving micro transitions (taken in response to raised events). This was creating issues when checking tags in guards.
