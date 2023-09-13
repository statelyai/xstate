---
'xstate': major
---

**Breaking:** The `state.children` property is now a mapping of invoked actor IDs to their `ActorRef` instances.

**Breaking:** The way that you interface with invoked/spawned actors is now through `ActorRef` instances. An `ActorRef` is an opaque reference to an `Actor`, which should be never referenced directly.

**Breaking:** The `origin` of an `SCXML.Event` is no longer a string, but an `ActorRef` instance.
