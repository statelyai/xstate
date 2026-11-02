---
'@xstate/effect': patch
---

Interrupting the fiber that owns an actor created with `createEffectActor` now waits for the finalizers of Effects invoked by that actor, even when the owner is interrupted immediately after the invoked Effect starts.
