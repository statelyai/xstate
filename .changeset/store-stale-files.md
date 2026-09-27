---
'@xstate/store': patch
---

Removed nonexistent `undo`, `persist`, `reset`, and `validate` entries from the package's `files` field. Subpath imports such as `@xstate/store/undo` are unaffected; they resolve through `exports`.
