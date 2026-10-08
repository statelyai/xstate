---
'xstate': patch
---

Children spawned or stopped by an entry function are no longer undone when a later state with an `invoke` is entered in the same microstep, such as the entered state's initial child. Before, a child spawned with `enq.spawn(...)` was dropped from `snapshot.children`, so `enq.sendTo(...)` dead-lettered events to it and stopping the parent left it running, and a child stopped with `enq.stop(...)` came back. The entry functions of states entered later in the microstep also receive the current `children`.
