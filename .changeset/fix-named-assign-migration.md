---
'@xstate/codemod': patch
---

Inline supported named `assign` actions as context patches instead of generating invalid v6 named actions. Report unsupported assignments for manual migration. Correct the `stateIn` migration hint to use the current transition state.
