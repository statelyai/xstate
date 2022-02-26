---
'xstate': patch
---

Fixed an issue with context type being inferred from too many places within `createMachine` call and possibly ending up as `any` for the entire machine.
