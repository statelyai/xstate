---
"@xstate/effect": patch
---

`createEffectActor` now shows observers each step in the order that `createActor` uses. The events that a transition emits come first, then `next`, or `complete` and `error` when the transition ends the actor. `join` resolves, and the `emitted(actor)` stream ends, after the events of the final transition.

A `stop()` from inside a step, such as from an `on` listener, now runs when the step ends. An actor that a listener stops during its final events still ends `done` with its output.
