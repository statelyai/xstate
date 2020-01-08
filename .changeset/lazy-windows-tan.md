---
'xstate': patch
---

The `escalate()` action can now take in an expression, which will be evaluated against the `context`, `event`, and `meta` to return the error data.
