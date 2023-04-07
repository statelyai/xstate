---
'@xstate/fsm': major
---

Observing a service via `service.subscribe(...)` no longer immediately receives the current state. Instead, the current state can be read from `service.state`, and observers will receive snapshots only when a transition in the service occurs.
