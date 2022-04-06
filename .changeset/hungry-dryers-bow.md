---
'xstate': patch
---

Fixed issues with not disposing some cached internal values when stopping interpreters, which could have led to issues when starting such an interpreter again.
