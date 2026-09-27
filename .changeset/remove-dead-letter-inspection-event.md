---
'xstate': minor
'@xstate/effect': patch
---

Remove the `@xstate.deadletter` inspection event; observe undelivered events with the `onRejectedEvent` option. The inspection protocol is now exactly `@xstate.actor` and `@xstate.transition`. In `@xstate/effect`, `deadLetters(actor)` now streams `EventRejection` objects.

```ts
createActor(machine, {
  onRejectedEvent: (rejection) => {
    console.log(rejection.event.type, rejection.reason, rejection.issues);
  }
});
```

Undelivered events are also available through `system.onRejectedEvent(listener)`, which accepts any number of listeners added at any time and returns a subscription. The `onRejectedEvent` option registers a listener the same way.

```ts
const subscription = actor.system.onRejectedEvent((rejection) => {
  console.log(rejection.event.type, rejection.reason);
});
subscription.unsubscribe();
```
