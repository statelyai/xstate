---
'@xstate/store': patch
---

Fix redo logic bug where redo would apply too many events when no transaction grouping is used
