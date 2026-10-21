---
'xstate': patch
---

`transition(machine, snapshot, event)` and `getMicrosteps(...)` no longer process events on a `done`, `error` or `stopped` snapshot. Every event is unhandled there, as it is for an actor with that status: the same snapshot comes back with no effects. Before, the machine's transitions still ran, so a done snapshot could leave its final state while keeping `status: 'done'`, an error snapshot could become `done`, and a stopped snapshot could emit `@xstate.terminate`.
