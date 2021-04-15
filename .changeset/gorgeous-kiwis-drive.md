---
'xstate': major
---

This update restricts invoked `Subscribable`s to `EventObject`s,
so that type inference can be done on which `Subscribable`s are
allowed to be invoked.

Existing `MachineConfig`s that invoke `Subscribable`s that are not
`Subscribable<EventObject>`s should be updated accordingly:
either their emissions are desired, and should thus be acted on
as events, or they are not, in which case an action would
probably be a better choice than a service.
