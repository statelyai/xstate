---
'xstate': patch
---

Fixed a type returned by a `raise` action - it's now `RaiseAction<TEvent> | SendAction<TContext, AnyEventObject, TEvent>` instead of `RaiseAction<TEvent> | SendAction<TContext, TEvent, TEvent>`. This makes it comaptible in a broader range of scenarios.
