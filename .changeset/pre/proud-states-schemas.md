---
'xstate': patch
---

Per-state schemas declared in `setup({ states })` are now available on the compiled machine's state nodes via `machine.states.X.schemas`, so tooling (e.g. per-state snapshot validators) can be derived from the machine alone. Previously they were only accessible on the setup return value.

```ts
import { setup, types } from 'xstate';

const machine = setup({
  states: {
    running: {
      schemas: { context: types<{ startedAt: number }>() }
    }
  }
}).createMachine({
  initial: 'running',
  states: {
    running: {}
  }
});

machine.states.running.schemas?.context; // the schema declared in setup
```
