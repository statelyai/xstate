---
'xstate': minor
---

You can now inspect actor system updates using the `inspect` option in `createActor(logic, { inspect })`. The types of **inspection events** you can observe include:

- `@xstate.actor` - An actor ref has been created in the system
- `@xstate.event` - An event was sent from a source actor ref to a target actor ref in the system
- `@xstate.snapshot` - An actor ref emitted a snapshot due to a received event

```ts
import { createMachine } from 'xstate';

const machine = createMachine({
  // ...
});

const actor = createActor(machine, {
  inspect: (inspectionEvent) => {
    if (inspectionEvent.type === '@xstate.actor') {
      console.log(inspectionEvent.actorRef);
    }

    if (inspectionEvent.type === '@xstate.event') {
      console.log(inspectionEvent.sourceRef);
      console.log(inspectionEvent.targetRef);
      console.log(inspectionEvent.event);
    }

    if (inspectionEvent.type === '@xstate.snapshot') {
      console.log(inspectionEvent.actorRef);
      console.log(inspectionEvent.event);
      console.log(inspectionEvent.snapshot);
    }
  }
});
```
