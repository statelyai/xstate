---
title: Inspection
description: Observe actor systems and transitions.
---

Pass an inspector to the root actor with the `inspect` option.

```ts
const actor = createActor(machine, {
  inspect: (inspectionEvent) => {
    console.log(inspectionEvent.type, inspectionEvent);
  }
});
```

Inspection emits three event types:

| Type | Contains |
| --- | --- |
| `@xstate.actor` | Actor identity and parent information. |
| `@xstate.transition` | The event, snapshot, source, target and microsteps. |
| `@xstate.deadletter` | An event that could not be delivered. |

Every event type carries `rootId`, the session ID of the root actor, and `actorRef`, the actor the event is about. Session IDs are unique across actors, so `rootId` identifies the system and `actorRef.sessionId` identifies an actor within it.

`@xstate.actor` announces every created actor: the root actor and each spawned or invoked child. It is the only topology event, so an inspector can draw the actor graph before any transition occurs.

| Property | Description |
| --- | --- |
| `parentRef` | The parent actor, or `undefined` for the root actor. |
| `id` | The actor's `id`. |
| `src` | The source logic, or its referenced string. |
| `snapshot` | The actor's initial snapshot. |

`@xstate.transition` announces a transition. Every property is always present, so an inspector can read each facet without narrowing.

| Property | Description |
| --- | --- |
| `eventType` | The event type. |
| `event` | The event that caused the transition. |
| `sourceRef` | The actor that sent the event, if any. |
| `targetRef` | The target actor, usually the same as `actorRef`. |
| `snapshot` | The resulting snapshot. |
| `microsteps` | The microstep transition definitions taken. |
| `actions` | The executed actions, as `{ type, params }`. |
| `sent` | Events relayed to other actors, as `{ targetRef, targetId, event, delay, id }`. |

`@xstate.deadletter` announces an undeliverable event, such as one sent to a stopped actor. Delivery is at-most-once, so this is observability, not retry.

| Property | Description |
| --- | --- |
| `sourceRef` | The actor that sent the event, or `undefined` when sent externally. |
| `event` | The undelivered event. |
| `reason` | Why delivery failed, such as `'stopped'`. |

Actor stop is derivable from `snapshot.status` on the actor's final `@xstate.transition` event, so there is no separate stop event. The v5 `@xstate.event`, `@xstate.snapshot`, `@xstate.action` and `@xstate.microstep` events are gone; `@xstate.transition` carries all of them.

Use inspection for developer tools, logs and visualizers. Do not change application state from an inspector.

Use inspection to build a statechart visualizer, or to attach actor and transition details to a failed request trace.

## Inspection cheatsheet

```ts
createActor(logic, { inspect });
createActor(logic, { inspect: (event) => console.log(event) });
event.rootId; // root actor session ID
event.actorRef; // '@xstate.actor' and '@xstate.transition'
event.parentRef, event.id, event.src, event.snapshot; // '@xstate.actor'
event.event, event.snapshot, event.sourceRef, event.targetRef; // '@xstate.transition'
event.microsteps, event.actions, event.sent; // '@xstate.transition'
```
