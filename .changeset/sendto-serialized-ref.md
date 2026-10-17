---
'xstate': patch
---

`enq.sendTo(...)` accepts a serialized actor ref — the `{ xstate$type: 'actorRef', id, address }` value an actor ref becomes after `JSON.stringify`, e.g. a `replyTo` in an event payload after persistence or a remote hop. The event is delivered to whichever actor is live at that address when the send executes (for a delayed send, when its timer fires), or reported as a `'missingTarget'` dead letter (via `onRejectedEvent`) when no live actor has it. Previously this threw a `TypeError` and the event was lost. Serialized refs held in `context` also keep their address across persistence and restore. Use the new `SerializedActorRef` type to type such fields.

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

Actor refs stored in context now persist with their address, so a ref to an actor that isn't a child (such as a stored `replyTo`) still routes after restore.

A pending delayed send to a serialized ref persists with that ref as its timer target and resolves it by address after restore.
