---
'xstate': patch
---

The `AnyStateMachine` type is now available, which can be used to express any state machine created from `createMachine(...)`:

```ts
import type { AnyStateMachine } from 'xstate';

// A function that takes in any state machine
function visualizeMachine(machine: AnyStateMachine) {
  // (exercise left to reader)
}
```
