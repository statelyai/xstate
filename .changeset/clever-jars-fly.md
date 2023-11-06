---
'xstate': minor
---

All inspector events (snapshot, event, actor) now have a common `actorRef` property. This makes it easier to discern which inspection event is for which actor:

```ts
const actor = createActor(someMachine, {
  inspect: (event) => {
    // Was previously a type error
    if (event.actorRef === actor) {
      // This event is for the root actor
    }

    if (event.type === '@xstate.event') {
      // previously event.targetRef
      event.actorRef;
    }
  }
});
```

In the `'xstate.event'` event, the `actorRef` property is now the target actor (recipient of the event). Previously, this was the `event.targetRef` property (which is now removed).
