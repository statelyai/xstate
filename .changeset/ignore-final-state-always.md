---
'xstate': patch
---

Ignore `always` transitions declared on final states and warn in development. Parent `onDone` transitions still run when their child reaches a final state.
