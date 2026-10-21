---
'xstate': major
---

Separate concrete actors from actor refs in public types. `ActorRef` now represents the consumer-facing contract for sending events, reading published snapshots, and listening to emitted events with `actorRef.on(...)`; concrete `Actor` instances provide lifecycle and runtime capabilities and still satisfy actor ref contracts.
