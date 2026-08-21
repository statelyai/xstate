---
'xstate': minor
---

Add separately declared internal event schemas with `schemas.internalEvents`. Internal events remain fully typed inside machines while staying out of the public actor event protocol. The existing top-level `internalEvents` list remains supported for migration.
