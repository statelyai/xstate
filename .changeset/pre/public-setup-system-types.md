---
'xstate': patch
---

Export setup system helper types used by public machine types.

This avoids inferred machine types referring to internal declaration paths when
`setup(...)` includes a typed system registry.
