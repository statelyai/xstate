---
'xstate': patch
---

`enq.spawn(...)` returns an inert actor ref while a transition is only evaluated, such as by `snapshot.can(event)` or when resolving conflicting transitions in parallel states. The ref has the `id` (and, when the parent is known, the `address`) the real spawn would get, an `undefined` `sessionId`, a stable `getSnapshot()`, a no-op `send()`, and `toJSON()` returning `{ $actor: address }`. Previously it was a bare `{ id }` object.
