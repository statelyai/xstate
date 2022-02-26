---
'xstate': patch
---

Fixed an issue with `ActorRefFrom` not resolving the typegen metadata from machine types given to it. This could sometimes result in types assignability problems, especially when using machine factories and `spawn`.
