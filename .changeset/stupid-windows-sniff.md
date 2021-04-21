---
'xstate': patch
---

In callback invokes, the types of `callback` and `onReceive` are properly scoped to the machine TEvent.
