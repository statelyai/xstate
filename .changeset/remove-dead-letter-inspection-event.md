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
