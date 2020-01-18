---
'xstate': patch
---

Removed `TContext` generic type parameter from `raise` action creator. It was never actually utilized internally and caused it being inferred to `unknown` which in turn could cause problems with type compatibility when type checking..
