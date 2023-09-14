---
'xstate': patch
---

Improved type safety of `spawn`ed inline actors when the actor types are not provided explicitly. It fixes an issue with an incompatible actor being assignable to a location accepting a different actor type (like a context property).
