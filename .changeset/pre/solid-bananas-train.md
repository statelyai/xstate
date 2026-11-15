---
'xstate': minor
'@xstate/codemod': patch
---

Add eventless `always` transitions to `xstate/fsm`. Machines follow these transitions during initialization and after handled events until no eventless transition is enabled.

```ts
import { createFSM } from 'xstate/fsm';

const machine = createFSM({
  initial: 'checking',
  states: {
    checking: { always: { target: 'ready' } },
    ready: {}
  }
});

machine.initialState.value; // 'ready'
```

Breaking beta change: `xstate/fsm` now requires object transition targets for `on` and `always`, matching the main XState API. Replace `on: { GO: 'ready' }` with `on: { GO: { target: 'ready' } }`. Keep `initial: 'idle'` unchanged. Transition functions must return an object or `undefined`.

Run the `@xstate/codemod` `string-targets` transform to update inline FSM configurations. Review separately stored configurations and functions returning strings manually.
