---
'xstate': patch
---

Invalid external events are now rejected at the delivery boundary instead of erroring the actor or throwing. This covers events whose payload fails a declared runtime validator schema and internal event types (`internalEvents`) sent from outside their owning actor. A rejected event is never delivered: the actor does not transition, does not error, and no API throws.

Rejections are reported through:

- a new `onRejectedEvent` dead-letter hook on `createActor(...)` options, which receives an `EventRejection` describing the event, target, source, origin, reason and validation issues;
- the `@xstate.deadletter` inspection event, which now also carries the validation `issues` and underlying `error` for boundary rejections;
- a development-mode console warning.

```ts
const actor = createActor(machine, {
  onRejectedEvent: (rejection) => {
    console.log(rejection.event, rejection.reason, rejection.issues);
  }
});
```

Pure `transition(...)` calls no longer throw for invalid external events: the snapshot is returned unchanged with a `@xstate.deadLetter` effect carrying the rejection, so durable hosts can journal rejections and replay stays total even with poisoned queued events. The effect executes through the `deadLetter` runtime operation, so `createDurable(...)` adapters journal rejections by implementing `deadLetter` like any other runtime operation.

Internal faults are unchanged: values the machine produces itself (input, context, output, emitted events and delayed raised events) that fail their schema still error the actor, and pure transitions still throw for them.
