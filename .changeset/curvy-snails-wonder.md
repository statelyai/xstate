---
'xstate': patch
---

The following utility types were previously returning `never` in some unexpected cases, and are now working as expected:

- `ContextFrom<T>`
- `EventFrom<T>`
- `EmittedFrom<T>`
