---
'xstate': patch
---

Fixed an inference issue that prevented `emit` used directly in `setup` (or bare `createMachine`) to benefit from `types.emitted` types.
