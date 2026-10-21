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

Sending `start` raises `tick` internally and the machine transitions to `done`. Sending `tick` directly rejects the event at the delivery boundary:

```ts
const actor = createActor(machine, {
  onRejectedEvent: (rejection) => {
    rejection.event; // { type: 'tick' }
    rejection.reason; // 'internalEvent'
  }
}).start();

actor.send({ type: 'tick' });
// The event is not delivered. `actor.send` does not throw and the actor
// does not error; its state is unchanged.
```

A rejected event never enters the machine. The rejection is reported two ways:

- The `onRejectedEvent` dead-letter hook on `createActor` options receives an `EventRejection` object with the `event`, `targetId`, `sourceRef`, `eventOrigin` (`'external'` or `'actor'`), `reason` and `error`.
- In development mode, a console warning describes the rejection.

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
allowed. Anything else is rejected: `actor.send` from application code, a
parent sending to a child, or a sibling actor.

> **Warning:** a rejection is silent unless you observe it. It does not throw and it does not error the actor. Register `onRejectedEvent` or `actor.system.onRejectedEvent(...)` to detect rejected events. Dead letters are not inspection events. Treat internal events as a private surface, and if application code needs to reach that behavior, expose a public event that raises the internal one.

Use internal events for:

- a `tick` that only the machine's own timer logic should produce
- `change.*` events raised by a form's own validation pass, so no caller can fake a field update
- upload progress events raised by an invoked actor's callbacks, where an outside `progress` event would corrupt the state

## TypeScript

The keys in `schemas.internalEvents` narrow the actor's public protocol: those
types, and types matched by a wildcard, are removed from what `actor.send` and
`actor.trigger` accept, so an invalid send is a type error rather than a
runtime rejection. They remain fully typed inside the machine for `on`
handlers, guards, actions, `enq.raise` and [transitions](transitions.md).

The top-level `internalEvents: ['tick']` list was removed before 6.0. Move
each listed event's schema from `schemas.events` to `schemas.internalEvents`.
In development builds, a machine config with a top-level `internalEvents` key
throws an error naming `schemas.internalEvents`.

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

## Validating public input

`machine.eventSchema` is a Standard Schema for complete public input event
objects. Validate untrusted input (including agent tool arguments) before sending:

```ts
const result = await machine.eventSchema['~standard'].validate(input);
if (result.issues) {
  throw new Error(result.issues[0]?.message);
}
actor.send(result.value);
```

The schema validates payloads using `schemas.events`, rejects declared internal
events (including wildcard descriptors), and rejects `xstate.*` / `@xstate.*`
runtime events. `xstate.route` is accepted only with a `to` destination identifying
an explicitly configured route. Route guards and current-state eligibility are
evaluated during delivery, not schema validation.

Without event schemas, application event names remain open. `types<T>()` provides
type inference only; use a runtime schema such as Zod to validate payloads.
Validation is not authorization: a well-formed public event may still require
application permission checks.

`actor.send(event)` keeps supporting trusted runtime delivery and replay. It does
not automatically run `machine.eventSchema`. For event histories,
`machineVersions().adaptEvents()` retains historical internal/runtime validation
when given actual machines.
