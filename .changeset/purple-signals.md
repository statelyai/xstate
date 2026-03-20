---
'xstate': patch
---

Added a new `compileMachineSignals(machine, options?)` utility to `xstate/graph`.

This compiles a built machine into a signal-oriented transition map where each
signal includes explicit source and target route IDs.

```ts
import { createMachine } from 'xstate';
import { compileMachineSignals } from 'xstate/graph';

const machine = createMachine({
  id: 'light',
  initial: 'green',
  states: {
    green: { on: { TIMER: 'yellow' } },
    yellow: { on: { TIMER: 'red' } },
    red: {}
  }
});

const compiled = compileMachineSignals(machine);
// compiled.bySignal.TIMER.routes =>
// [{ source: '#light.green', targets: ['#light.yellow'] }, ...]
```
