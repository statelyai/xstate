---
'xstate': minor
---

All `TTypestate` type parameters default to `{ value: any; context: TContext }` now and the parametrized type is passed correctly between various types which results in more accurate types involving typestates.
