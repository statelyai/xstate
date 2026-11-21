---
'xstate': patch
---

Reject `waitFor` with a predicate's thrown value and release its timer, actor subscription, and abort listener instead of leaving the wait pending.
