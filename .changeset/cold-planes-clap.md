---
'xstate': minor
---

Inspecting an actor system via `actor.system.inspect(ev => …)` now accepts a function or observer, and returns a subscription:

```ts
const actor = createActor(someMachine);

const sub = actor.system.inspect((inspectionEvent) => {
  console.log(inspectionEvent);
});

// Inspection events will be logged
actor.start();
actor.send({ type: 'anEvent' });

// ...

sub.unsubscribe();

// Will no longer log inspection events
actor.send({ type: 'someEvent' });
```
