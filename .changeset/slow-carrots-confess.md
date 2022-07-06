---
'xstate': patch
---

Fixed the declared signature of one of the `StateMachine`'s methods to avoid using a private name `this`. This makes it possible to emit correct `.d.ts` for the associated file.
