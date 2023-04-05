---
'xstate': major
---

The `self` actor reference is now available in all action metas. This makes it easier to reference the "self" `ActorRef` so that actions such as `sendTo` can include it in the event payload:

```ts
// Sender
actions: sendTo('somewhere', (ctx, ev, { self }) => ({
  type: 'EVENT',
  ref: self
})),

// ...

// Responder
actions: sendTo((ctx, ev) => ev.ref, ...)
```
