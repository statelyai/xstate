---
'@xstate/react': patch
---

The `send` type returned in the tuple from `useActor(someService)` was an incorrect `never` type; this has been fixed.
