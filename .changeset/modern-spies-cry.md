---
'@xstate/fsm': patch
---

Fixed state types when initializing the machine, as well as when switching to another state. Previously, the "string" type was used for this, which allowed any value to be passed and led to a subtle error in a running application. After this change, the error will be seen at the development stage.
