---
"@xstate/effect": patch
---

`createEffectActor` now shows observers each step in the order that `createActor` uses. The events that a transition emits come first, then `next`, or `complete` and `error` when the transition ends the actor. `join` resolves, and the `emitted(actor)` stream ends, after the events of the final transition.

A `stop()` that an `on` listener or an observer calls synchronously while the actor delivers a step now runs when that step ends, as in `createActor`. A `stop()` from anywhere else still stops the actor at once. If the step ends the actor with `done` or `error`, its `sendAndAwait` receipt now succeeds with that snapshot, also when a listener stopped the actor during the step.
