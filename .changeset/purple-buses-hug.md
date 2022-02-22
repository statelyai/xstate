---
'xstate': patch
---

External root-level transitions (which should be invalid – only internal root-level transitions are allowed) will no longer restart root-level invocations. See #3072 for more details.
