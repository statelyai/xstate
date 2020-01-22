---
'xstate': patch
---

Fixed memory leak - each created service has been registered in internal map but it was never removed from it. Registration has been moved to a point where Interpreter is being started and it's deregistered when it is being stopped.
