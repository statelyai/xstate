---
'xstate': patch
---

Fixed an issue with event type being inferred from too many places within `createMachine` call and possibly ending up as `any`/`AnyEventObject` for the entire machine.
