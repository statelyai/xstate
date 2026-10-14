---
'xstate': patch
---

`enq.sendTo(...)` accepts a serialized actor ref — the `{ xstate$type: 'actorRef', id, address }` value an actor ref becomes after `JSON.stringify`, e.g. a `replyTo` in an event payload after persistence or a remote hop. The event is delivered to the live actor at that address, or reported as a `'missingTarget'` dead letter (via `onRejectedEvent`) when no live actor has it. Previously this threw a `TypeError` and the event was lost. Serialized refs held in `context` also keep their address across persistence and restore. Use the new `SerializedActorRef` type to type such fields.

```ts
const server = createMachine({
  schemas: {
    events: {
      ping: types<{ replyTo: SerializedActorRef; requestId: string }>()
    }
  },
  on: {
    ping: ({ event }, enq) => {
      enq.sendTo(event.replyTo, { type: 'pong', requestId: event.requestId });
    }
  }
});
```
