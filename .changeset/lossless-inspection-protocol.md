---
'xstate': minor
---

The inspection protocol is now both **simpler (2 event types)** and **lossless**. Every facet the previous 6-event protocol carried is preserved, but with flat, always-present payloads so you never narrow on an absent field.

- `@xstate.actor` — the single topology event, emitted once per actor (root and every spawned/invoked child). Carries `actorRef`, `parentRef`, `id`, `src`, and the initial `snapshot`, so the actor graph is drawable before any transitions occur. Actor _stop_ is derivable from `snapshot.status` on the final transition.
- `@xstate.transition` — carries every transition facet: `event`, `snapshot`, `sourceRef`, `microsteps`, plus the executed `actions` and the events `sent` to other actors (each with `targetRef`/`targetId`, `event`, and `delay`/`id` for scheduled sends). These arrays are **always present** (empty, not absent), so you can read `event.actions` / `event.sent` / `event.microsteps` directly.

The concrete event interfaces `ActorInspectionEvent` and `TransitionInspectionEvent` (and the `ActionRecord` / `SentRecord` payload types) are exported alongside the `InspectionEvent` union, which remains a discriminated union on `type`. This is a superset of what `@statelyai/inspect` consumes.

```ts
const actor = createActor(machine, {
  inspect: (ev) => {
    if (ev.type === '@xstate.actor') {
      // topology: ev.actorRef, ev.parentRef, ev.id, ev.src, ev.snapshot
    } else if (ev.type === '@xstate.transition') {
      ev.event; // the event that caused the transition
      ev.snapshot; // resulting snapshot
      ev.actions; // ActionRecord[] — executed actions (always present)
      ev.sent; // SentRecord[] — relayed/scheduled events (always present)
      ev.microsteps; // microstep transitions (always present)
    }
  }
});
```
