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

Inspection emits two event types:

| Type | Contains |
| --- | --- |
| `@xstate.actor` | Actor identity and parent information. |
| `@xstate.transition` | The event, snapshot, source, target and microsteps. |

Use inspection for developer tools, logs and visualizers. Do not change application state from an inspector.

Inspection can power a statechart visualizer or attach actor and transition details to a failed request trace.

## Inspection cheatsheet

```ts
createActor(logic, { inspect });
createActor(logic, { inspect: (event) => console.log(event) });
```
