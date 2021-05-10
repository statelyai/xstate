---
'xstate': patch
---

Invocations and entry actions for _combinatorial_ machines (machines with only a single root state) now behave predictably and will not re-execute upon targetless transitions.
