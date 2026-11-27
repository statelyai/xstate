---
'@xstate/codemod': patch
---

Inline supported named `assign` actions as context patches. Report unsupported assignments for manual migration, including those that could read a different variable after conversion. Correct the `stateIn` migration hint to use the current transition state.
