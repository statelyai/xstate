---
"xstate": patch
---

An `xstate/fsm` `always` transition that leaves the state and context unchanged now ends the eventless chain instead of looping forever.

```ts
const machine = createFSM({
  initial: 'idle',
  states: { idle: { always: { target: 'idle' } } }
});

machine.initialState.value; // 'idle'
```
