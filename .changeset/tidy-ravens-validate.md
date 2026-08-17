---
'xstate': patch
---

Fixed `createSystem(...).setup(...)` to preserve runtime validator types alongside typed actor registries. Validated setups now reject unsupported transforming schemas and carry validation into derived setups.
