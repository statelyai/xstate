---
'xstate': minor
---

Add `getInitialMicrosteps(…)` and `getMicrosteps(…)` functions that return an array of `[snapshot, actions]` tuples for each microstep in a transition.

```ts
import { createMachine, getInitialMicrosteps, getMicrosteps } from 'xstate';

const machine = createMachine({
  initial: 'a',
  states: {
    a: {
      entry: () => console.log('enter a'),
      on: {
        NEXT: 'b'
      }
    },
    b: {
      entry: () => console.log('enter b'),
      always: 'c'
    },
    c: {}
  }
});

// Get microsteps from initial transition
const initialMicrosteps = getInitialMicrosteps(machine);
// Returns: [
//  [snapshotA, [entryActionA]]
// ]

// Get microsteps from a transition
const microsteps = getMicrosteps(machine, initialMicrosteps[0][0], {
  type: 'NEXT'
});
// Returns: [
//  [snapshotB, [entryActionB]],
//  [snapshotC, []]
// ]

// Each microstep is a tuple of [snapshot, actions]
for (const [snapshot, actions] of microsteps) {
  console.log('State:', snapshot.value);
  console.log('Actions:', actions.length);
}
```
