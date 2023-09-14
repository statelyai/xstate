---
'xstate': major
---

Returning promises when creating a callback actor doesn't work anymore. Only cleanup functions can be returned now (or `undefined`).
