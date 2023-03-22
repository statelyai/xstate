---
'xstate': major
---

The `interpreter.onStop(...)` method has been removed. Use an observer instead via `interpreter.subscribe({ complete() { ... } })` instead.
