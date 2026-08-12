---
title: Inspect actor systems
description: Observe actor lifecycle, events and transitions.
---

Pass an inspector to `createActor(...)` to observe the root actor and its children.

```ts
const actor = createActor(machine, {
  inspect: (event) => {
    if (event.type === '@xstate.transition') {
      console.log(event.eventType, event.snapshot);
    }
  }
});

actor.start();
```

Use inspection for developer tools, logs and telemetry. Do not put application decisions in an inspector.

Inspection can show actor activity in a development panel or attach the last transition to a failed backend request trace.
