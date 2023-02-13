---
'xstate': minor
---

All actions received a new generic: `TExpressionEvent`. To type things more correctly and allow TS to infer things better we need to distinguish between all events accepted by a machine (`TEvent`) and the event type that actions are "called" with (`TExpressionEvent`).

It's best to rely on type inference so you shouldn't have to specify this generic manually all over the place.
