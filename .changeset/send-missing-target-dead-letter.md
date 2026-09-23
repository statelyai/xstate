---
'xstate': minor
---

`enq.sendTo(...)` to a missing target no longer errors the sending actor. Sending to an `undefined` ref, to a child id with no running child, or to `parent` from a root actor now produces a dead letter with reason `'missingTarget'`: the actor stays `active`, `onRejectedEvent` and the `@xstate.deadletter` inspection event receive the event, and development builds log a warning naming the sender and the target. State `onError` handlers no longer receive `xstate.error.communication` for these sends.

```ts
const actor = createActor(machine, {
  onRejectedEvent: (rejection) => {
    if (rejection.reason === 'missingTarget') {
      console.log(rejection.event, rejection.targetId);
    }
  }
});
```
