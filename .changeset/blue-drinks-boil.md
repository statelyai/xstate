---
'@xstate/fsm': patch
---

Fixed an issue with `state.matches(...)` narrowing down `state` to `never` for the "alternate" branch of the code when no type states were defined.
