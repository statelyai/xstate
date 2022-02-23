---
'xstate': patch
---

Fixed an issue with not being able to call `createMachine` in a generic context when the type for the context was generic and not concrete.
