---
'xstate': major
---

The `interpreter.onError(...)` method has been removed. Use `interpreter.subscribe({ error(err) => { ... } })` instead.
