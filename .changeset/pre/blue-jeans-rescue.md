---
'xstate': minor
---

Observe emitted events from every actor in a system with `createSystem({ onEmitted })`. The callback receives the source actor and original event, including emissions from invoked and spawned children.

```ts
const system = createSystem({
  onEmitted: ({ actorRef, event }) => {
    analytics.track(`${actorRef.id}.${event.type}`, event);
  }
});

const root = system.createActor(applicationMachine);
root.start();
```

Use `system.onEmitted(listener)` for a subscription you can remove with `.unsubscribe()`. Existing `actor.on(...)` handlers continue to observe only that actor's emissions.
