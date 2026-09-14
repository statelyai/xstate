---
'xstate': patch
---

Preserve a state's existing input when a transition targets that state without
reentering it. Reentering transitions continue to replace the state input.
