---
'xstate': patch
---

The `AnyState` and `AnyStateMachine` types are now available, which can be used to express any state and state machine, respectively:

```ts
import type { AnyState, AnyStateMachine } from 'xstate';

// A function that takes in any state machine
function visualizeMachine(machine: AnyStateMachine) {
  // (exercise left to reader)
}

function logState(state: AnyState) {
  // ...
}
```
