---
'xstate': minor
---

Add `createStateConfig(...)` — author a standalone, fully-typed state node config (with `schemas`) that can be composed into a machine, mirroring how `setup(...).createMachine(...)` infers types.

```ts
import { createStateConfig } from 'xstate';

const loading = createStateConfig({
  on: {
    RESOLVE: 'success'
  }
});
```

This is the building block for authoring machines as plain data: a `createStateConfig` node is a typed, serializable config object you compose into a machine — useful for data-first / JSON-driven state machines (round-tripping with `serializeMachine`/`createMachineFromConfig`) while keeping per-state schema typing.
