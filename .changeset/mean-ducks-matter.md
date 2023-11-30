---
'xstate': major
---

The order of type parameters in `ActorRef` has been changed from from `ActorRef<TEvent, TSnapshot>` to `ActorRef<TSnapshot, TEvent>` for consistency with other types.
