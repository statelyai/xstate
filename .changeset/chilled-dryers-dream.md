---
'xstate': minor
---

The `sendTo(actorRef, event)` action creator has been introduced. It allows you to specify the recipient actor ref of an event first, so that the event can be strongly typed against the events allowed to be received by the actor ref:

```ts
// ...
entry: sendTo(
  (ctx) => ctx.someActorRef,
  { type: 'EVENT_FOR_ACTOR' }
),
// ...
```
