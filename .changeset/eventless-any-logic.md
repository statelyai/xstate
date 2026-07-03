---
'xstate': patch
---

Allow machines with no external events to be used anywhere `AnyActorLogic`, `AnyStateMachine`, `AnyActorRef`, or `AnyMachineSnapshot` is expected.

```ts
const machine = setup({
  schemas: {
    events: {}
  }
}).createMachine({});

const logic: AnyActorLogic = machine;
const anyMachine: AnyStateMachine = machine;

const actor = createActor(machine);
const anyActor: AnyActorRef = actor;
const anySnapshot: AnyMachineSnapshot = actor.getSnapshot();
```

Machines with empty event schemas still reject external events sent to their actors.
