---
'xstate': patch
---

Wait for every direct final child of a parallel state to enter before completing the parallel state. Completion output now sees the context updates from those entry actions, and events raised by the last final child's entry are queued before the parallel completion event.
