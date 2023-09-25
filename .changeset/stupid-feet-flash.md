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
      // output: {
      //   status: 200
      // }
    }
  },
  // This will be the final output of the machine
  // present on `snapshot.output`
  // when the machine reaches the top-level final state ("finished")
  output: {
    status: 200
  }
});
```
