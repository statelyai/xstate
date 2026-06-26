---
'xstate': patch
---

Empty Standard Schema event objects now infer as type-only events, so `{ type: 'SEND' }` is accepted for an empty `SEND` payload schema while non-empty schemas still require their payload fields.
