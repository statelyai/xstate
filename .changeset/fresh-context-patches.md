---
'@xstate/store': minor
---

Store transitions may now return partial context updates. For discriminated union contexts, returned updates must still satisfy the context type when applied.
