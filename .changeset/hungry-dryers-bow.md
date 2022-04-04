---
'xstate': patch
---

Fixed issues with not disposing some cached internal values when stopping interpreters. This could lead to issues when starting such an interpreter again.
