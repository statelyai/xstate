---
title: Internal events
description: Declare events that the machine may raise but no one may send in.
---

Declare private event payload schemas in `schemas.internalEvents`. These events
are part of the machine's internal event union, but are excluded from the
public `actor.send(...)` and `actor.trigger` protocols.

```ts
const machine = createMachine({
  schemas: {
    events: {
      start: z.object({})
    },
    internalEvents: {
      tick: z.object({ count: z.number() })
    }
  },
  initial: 'idle',
  states: {
    idle: {
      on: {
        start: (_, enq) => {
          enq.raise({ type: 'tick', count: 1 });
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

Internal events are still ordinary events in every other respect. They appear
in `on` handlers and are raised with `enq.raise` like any other event. They do
not need a duplicate entry in `schemas.events`.

## Wildcard patterns

Entries may use a `.`-segment wildcard, which covers every event type under that prefix.

```ts
schemas: {
  internalEvents: {
    'change.*': z.object({ value: z.string() })
  }
}
```

With that in place, `change.value`, `change.status` and any other `change.*` event can be raised internally but is rejected from outside.

## What counts as "outside"

The check compares the sender to the receiver. An internally executed
self-targeted effect such as `enq.raise(...)` or `enq.sendTo(self, ...)` is
allowed. Anything else throws: `actor.send` from application code, a parent
sending to a child, or a sibling actor.

> **Warning:** the error is thrown synchronously at the call site, not routed to the actor's error handling. Treat internal events as a private surface, and if application code needs to reach that behavior, expose a public event that raises the internal one.

Use internal events for:

- a `tick` that only the machine's own timer logic should produce
- `change.*` events raised by a form's own validation pass, so no caller can fake a field update
- upload progress events raised by an invoked actor's callbacks, where an outside `progress` event would corrupt the state

## TypeScript

The keys in `schemas.internalEvents` narrow the actor's public protocol: those
types, and types matched by a wildcard, are removed from what `actor.send` and
`actor.trigger` accept. They remain fully typed inside the machine for `on`
handlers, guards, actions, `enq.raise` and [transitions](transitions.md).

The legacy top-level form remains supported for migration:

```ts
schemas: { events: { tick: z.object({}) } },
internalEvents: ['tick'] as const
```

It is deprecated; move each listed event to `schemas.internalEvents`. The
legacy list is useful when a machine's existing public event schemas are being
split incrementally.

## Internal events cheatsheet

```ts
createMachine({
  schemas: {
    events: {
      start: z.object({})
    },
    internalEvents: {
      tick: z.object({}),
      'change.*': z.object({ value: z.string() })
    }
  },
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
