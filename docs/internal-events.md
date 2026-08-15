---
title: Internal events
description: Declare events that the machine may raise but no one may send in.
---

`internalEvents` lists event types that the machine can raise to itself but that cannot be sent from outside the actor.

```ts
const machine = createMachine({
  schemas: {
    events: {
      start: z.object({}),
      tick: z.object({})
    }
  },
  internalEvents: ['tick'] as const,
  initial: 'idle',
  states: {
    idle: {
      on: {
        start: (_, enq) => {
          enq.raise({ type: 'tick' });
        },
        tick: { target: 'done' }
      }
    },
    done: {}
  }
});
```

Sending `start` raises `tick` internally and the machine transitions to `done`. Sending `tick` directly throws:

```ts
const actor = createActor(machine).start();

actor.send({ type: 'tick' });
// Error: Internal event "tick" cannot be sent to actor "<actor id>" from outside.
```

The actor's state is unchanged, because the throw happens before the event is delivered.

Internal events are still ordinary events in every other respect. They need a schema entry, they appear in `on` handlers, and they are raised with `enq.raise` like any other event.

## Wildcard patterns

Entries may use a `.`-segment wildcard, which covers every event type under that prefix.

```ts
internalEvents: ['change.*'] as const
```

With that in place, `change.value`, `change.status` and any other `change.*` event can be raised internally but is rejected from outside.

## What counts as "outside"

The check compares the sender to the receiver. An actor raising or sending an event to itself is allowed. Anything else throws: `actor.send` from application code, a parent sending to a child, or a sibling actor.

> **Warning:** the error is thrown synchronously at the call site, not routed to the actor's error handling. Treat internal events as a private surface, and if application code needs to reach that behavior, expose a public event that raises the internal one.

Use internal events for:

- a `tick` that only the machine's own timer logic should produce
- `change.*` events raised by a form's own validation pass, so no caller can fake a field update
- upload progress events raised by an invoked actor's callbacks, where an outside `progress` event would corrupt the state

## TypeScript

Declaring `internalEvents` with `as const` narrows the actor's send type: listed types, and types matched by a wildcard, are removed from what `actor.send` accepts, so an invalid send is a type error rather than a runtime throw. The types must still exist in the events schema, and they remain fully typed inside the machine for `on` handlers, `enq.raise` and [transitions](transitions.md).

## Internal events cheatsheet

```ts
createMachine({
  schemas: {
    events: {
      start: z.object({}),
      tick: z.object({}),
      'change.value': z.object({ value: z.string() })
    }
  },
  internalEvents: ['tick', 'change.*'] as const,
  initial: 'idle',
  states: {
    idle: {
      on: {
        start: (_, enq) => {
          enq.raise({ type: 'tick' });
        },
        tick: { target: 'done' }
      }
    },
    done: {}
  }
});
```
