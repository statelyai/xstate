---
'xstate': major
---

The final `output` of a state machine is now specified directly in the `output` property of the machine config:

```ts
const machine = createMachine({
  initial: 'started',
  states: {
    started: {
      // ...
    },
    finished: {
      type: 'final'
      // moved to the top level
      //
      // output: {
      //   status: 200
      // }
    }
  },
  // This will be the final output of the machine
  // present on `snapshot.output` and in the done events received by the parent
  // when the machine reaches the top-level final state ("finished")
  output: {
    status: 200
  }
});
```
