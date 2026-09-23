---
'xstate': patch
---

A transition function that returns a promise now throws a descriptive execution error (recoverable with a state `onError`) instead of leaving the actor unchanged with an internal error. The returned promise's rejection is observed, so no unhandled rejection is reported. Calling `enq.*` after the transition function returned now throws in development and does nothing in production.
