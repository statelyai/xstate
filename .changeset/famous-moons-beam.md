---
'@xstate/fsm': minor
---

The `.state` property is now exposed on the service returned from `interpret(machine)`, which is a getter that returns the latest state of the machine.
