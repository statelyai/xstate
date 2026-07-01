---
'xstate': patch
---

Allow machines with no external events to be used anywhere `AnyActorLogic` or `AnyStateMachine` is expected.

```ts
const machine = setup({
  schemas: {
    events: {}
  }
}).createMachine({});

const logic: AnyActorLogic = machine;
const anyMachine: AnyStateMachine = machine;
```

Machines with empty event schemas still reject external events sent to their actors.
