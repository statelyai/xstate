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

Inspection events describe actors, events, snapshots and transitions. A transition event has the type `@xstate.transition`.

Use inspection for developer tools, logs and visualizers. Do not change application state from an inspector.
