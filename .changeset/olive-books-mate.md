---
'xstate': patch
---

Fixed an issue with `.nextState(event)` calls accidentally executing actions in machines with `predictableActionArguments`.
