---
'xstate': patch
---

Delayed transitions defined using `after` were previously causing a circular dependency when the machine was converted `.toJSON()`. This has now been fixed.
