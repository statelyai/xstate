---
'xstate': minor
---

Add eventless `always` transitions to `xstate/fsm`. Machines follow these transitions during initialization and after handled events until no eventless transition is enabled.

```ts
import { createFSM } from 'xstate/fsm';

const machine = createFSM({
  initial: 'checking',
  states: {
    checking: { always: 'ready' },
    ready: {}
  }
});

machine.initialState.value; // 'ready'
```
