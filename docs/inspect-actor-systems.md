---
title: Inspect actor systems
description: Log transitions in development and attach them to error reports.
---

An inspector passed to the root actor observes the whole system: the root actor, every invoked or spawned child, and every transition. This guide uses it for a development log and for telemetry.

## 1. Attach an inspector in development only

Inspection runs on every transition, so keep it out of production builds. Pass `undefined` and `createActor(...)` behaves as if no inspector were given.

```ts
import { createActor, type InspectionEvent } from 'xstate';

const isDev = process.env.NODE_ENV !== 'production';

const checkout = createActor(checkoutMachine, {
  inspect: isDev ? inspect : undefined
}).start();
```

## 2. Log transitions readably

Inspection emits three events: `@xstate.actor` when an actor is created, `@xstate.transition` when one takes a transition, and `@xstate.event.rejected` when an event is rejected at the delivery boundary. Filter to the type you need, then print the event that arrived and the state it produced.

Transitions identify their actor by `actorRef.sessionId`, which is unique but not readable. `@xstate.actor` carries the actor's `id`, so keep a map of names as actors appear.

```ts
const names = new Map<string | undefined, string>();

function inspect(inspectionEvent: InspectionEvent) {
  if (inspectionEvent.type === '@xstate.actor') {
    names.set(inspectionEvent.actorRef.sessionId, inspectionEvent.id);
    return;
  }

  const { actorRef, eventType, snapshot } = inspectionEvent;
  const value = 'value' in snapshot ? snapshot.value : snapshot.status;

  console.log(
    `[${names.get(actorRef.sessionId)}] ${eventType} → ${JSON.stringify(value)}`
  );
}
```

The root actor's first transition is `@xstate.init`, so the log starts with the initial state. Only machine snapshots have a `value`; a child running async logic reports its `status` instead. A `sessionId` is assigned once an actor starts, which is why the map allows `undefined` keys.

Filter further when a system is noisy. An early `if (!eventType.startsWith('payment.')) return;` keeps payment activity and drops everything else.

## 3. Inspect the whole tree

One inspector on the root covers the system. Every event carries `rootId` for the system and `actorRef.sessionId` for the actor within it, so two children with the same `id` are still distinguishable.

`@xstate.actor` announces each actor and its parent before it transitions, which is enough to draw the tree up front:

```ts
function logActors(inspectionEvent: InspectionEvent) {
  if (inspectionEvent.type !== '@xstate.actor') return;

  const { parentRef, id } = inspectionEvent;

  console.log(parentRef ? `${names.get(parentRef.sessionId)} → ${id}` : id);
}
```

## 4. Forward transitions to telemetry

Keep the last transition per actor and attach it to error reports. The report then says which state the actor was in and which event got it there.

```ts
const lastTransitions = new Map<
  string | undefined,
  { event: unknown; value: unknown }
>();

const actor = createActor(checkoutMachine, {
  inspect: (inspectionEvent) => {
    if (inspectionEvent.type !== '@xstate.transition') return;

    const { actorRef, event, snapshot } = inspectionEvent;

    lastTransitions.set(actorRef.sessionId, {
      event,
      value: 'value' in snapshot ? snapshot.value : snapshot.status
    });
  }
}).start();

actor.subscribe({
  error: (error) => {
    reportError(error, {
      lastTransition: lastTransitions.get(actor.sessionId)
    });
  }
});
```

Redact before sending. Events and context often carry addresses, card details and tokens.

> **Warning:** An inspector observes; it must not change application state. Send events from your machine, not from an inspector.

## 5. Use the visual inspector

[`@statelyai/inspect`](https://github.com/statelyai/inspect) consumes the same inspection events and draws the running system as a statechart instead of a log.

```bash
npm install @statelyai/inspect
```

Create its inspector and pass it to the same `inspect` option, in development only.

## What next?

- [Inspection](inspection.md) for every property on each inspection event type.
- [Listen and subscribe](listen-and-subscribe.md) for reading actor state in application code.
- [Systems](systems.md) for how actors are related within a system.
