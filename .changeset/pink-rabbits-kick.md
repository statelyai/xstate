---
'xstate': patch
---

Fixed an issue with nested `state.matches` calls when the typegen was involved. The `state` ended up being `never` and thus not usable.
