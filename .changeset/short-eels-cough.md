---
'xstate': patch
'@xstate/graph': patch
'@xstate/inspect': patch
'@xstate/react': patch
'@xstate/vue': patch
---

Fixed compatibility with Skypack by exporting some shared utilities from root entry of XState and consuming them directly in other packages (this avoids accessing those things using deep imports and thus it avoids creating those compatibility problems).
