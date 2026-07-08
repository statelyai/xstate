---
'xstate': patch
---

Registered invoke `onDone` callbacks now receive the invoked actor's output type, and `machine.provide({ actorSources })` accepts compatible actor implementations with sound input/output variance.
