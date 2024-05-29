---
'@xstate/graph': major
---

pr: #4896
commit: 7c6e2ea

The `adjacencyMapToArray(…)` helper function has been introduced, which converts an adjacency map to an array of `{ state, event, nextState }` objects.

```ts
import { getAdjacencyMap, adjacencyMapToArray } from '@xstate/graph';

const machine = createMachine({
  initial: 'green',
  states: {
    green: {
      on: {
        TIMER: 'yellow'
      }
    },
    yellow: {
      on: {
        TIMER: 'red'
      }
    },
    red: {
      on: {
        TIMER: 'green'
      }
    }
  }
});

const arr = adjacencyMapToArray(getAdjacencyMap(machine));
// [
//   {
//     "state": {value: "green", ... },
//     "event": { type: "TIMER" },
//     "nextState": { value: "yellow", ... }
//   },
//   {
//     "state": {value: "yellow", ... },
//     "event": { type: "TIMER" },
//     "nextState": { value: "red", ... }
//   },
//   {
//     "state": {value: "red", ... },
//     "event": { type: "TIMER" },
//     "nextState": { value: "green", ... }
//   },
//   {
//     "state": {value: "green", ... },
//     "event": { type: "TIMER" },
//     "nextState": { value: "yellow", ... }
//   },
// ]
```
